import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Magic Link URL の HMAC-SHA256 署名ユーティリティ (#146)
 *
 * 親 Issue: #140 / 先行: #145
 *
 * ## 背景
 * NextAuth EmailProvider が生成する検証 URL は `token` (乱数) だけで認証される。
 * 以下のような運用ミス / 経路で token が漏洩した場合でも、署名付き URL なら
 * `ADMIN_MAGIC_LINK_HMAC_SECRET` を知らない攻撃者は consume できない。
 *
 *   - メールクライアントのプレビュー経路でのリーク
 *   - Resend などメール配送経路でのログ残存
 *   - スクリーンショット共有時の露出
 *
 * ## 仕様
 * - `sig` クエリに HMAC-SHA256(email + token + expires) を base64url で載せる。
 * - 検証は `crypto.timingSafeEqual` による constant-time 比較。
 * - `NEXTAUTH_SECRET` とは **別の** シークレットを利用する (権限分離)。
 *   ADMIN_MAGIC_LINK_HMAC_SECRET が未設定の場合は fail closed。
 *
 * ## payload canonical form
 * 署名対象は `email + "\n" + token + "\n" + expires(unix ms)` に正規化する。
 * `\n` 区切りを使うのは、email / token 中に `:` や `|` などの制御文字が
 * 入り込む可能性を考慮し、改行文字で確実に分離するため。
 * email は trim + lowercase に正規化する (AdminAccount 側の正規化と合わせる)。
 */

/**
 * HMAC 署名ロジックを切り出した canonical payload 生成。
 * テストから直接呼べるよう export する。
 */
export function buildMagicLinkHmacPayload(params: {
  email: string;
  token: string;
  expires: number;
}): string {
  const normalizedEmail = params.email.trim().toLowerCase();
  return `${normalizedEmail}\n${params.token}\n${params.expires}`;
}

/**
 * email + token + expires から HMAC-SHA256 署名を生成 (base64url)。
 */
export function computeMagicLinkSignature(params: {
  email: string;
  token: string;
  expires: number;
  secret: string;
}): string {
  if (!params.secret) {
    throw new Error("[magicLinkHmac] secret must not be empty");
  }
  const payload = buildMagicLinkHmacPayload({
    email: params.email,
    token: params.token,
    expires: params.expires,
  });
  return createHmac("sha256", params.secret).update(payload).digest("base64url");
}

/** URL クエリに付ける署名パラメータ名 */
export const MAGIC_LINK_SIGNATURE_PARAM = "sig";

/**
 * 署名対象の expires (unix ms) を載せる URL クエリのパラメータ名。
 * 生成側 (`signMagicLinkUrl`) と検証側 (route handler) で同一名を使うため定数化 (#146 m-5)。
 */
export const MAGIC_LINK_EXPIRES_PARAM = "sig_exp";

/**
 * NextAuth EmailProvider が生成した Magic Link URL に `sig` クエリを付与する。
 * 既に `sig` が付いている場合は上書きする (再署名)。
 *
 * NextAuth が URL に乗せるクエリ (`token`, `email`, `callbackUrl`) はそのまま
 * 保持する。`sig` 以外の改ざんは verify 時に `token` / `email` / `expires` の
 * 署名一致で検出する。
 */
export function signMagicLinkUrl(params: {
  url: string;
  email: string;
  token: string;
  expires: Date;
  secret: string;
}): string {
  const expiresMs = params.expires.getTime();
  const signature = computeMagicLinkSignature({
    email: params.email,
    token: params.token,
    expires: expiresMs,
    secret: params.secret,
  });
  const urlObj = new URL(params.url);
  urlObj.searchParams.set(MAGIC_LINK_SIGNATURE_PARAM, signature);
  // expires は検証側が token 検索せずに復元できるよう同梱する。
  // 値は AdminVerificationToken.expires とクライアント時計から独立した認可に利用しない
  // (DB 側の expires が最終判定)。ここでは「署名対象 expires」の同一性を担保するのが目的。
  urlObj.searchParams.set(MAGIC_LINK_EXPIRES_PARAM, String(expiresMs));
  return urlObj.toString();
}

/** 署名検証結果 */
export type MagicLinkVerifyResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing_signature"
        | "missing_expires"
        | "invalid_encoding"
        | "length_mismatch"
        | "signature_mismatch";
    };

/**
 * URL クエリに含まれる `sig` / `sig_exp` / `token` / `email` を使って署名を検証する。
 *
 * - `crypto.timingSafeEqual` で constant-time 比較 (length mismatch を情報漏洩させない
 *   よう、別 reason で報告し呼び出し側で動作を揃える)。
 * - 署名検証に失敗した場合は AdminVerificationToken の consume に進ませない
 *   (呼び出し側で 400 / AccessDenied を返す)。
 */
export function verifyMagicLinkSignature(params: {
  email: string;
  token: string;
  sig: string | null | undefined;
  sigExpires: string | null | undefined;
  secret: string;
}): MagicLinkVerifyResult {
  if (!params.sig) {
    return { ok: false, reason: "missing_signature" };
  }
  if (!params.sigExpires) {
    return { ok: false, reason: "missing_expires" };
  }
  const expiresMs = Number(params.sigExpires);
  // Number.isFinite は NaN / ±Infinity をすべて false として扱うため、
  // これだけで「有限数値であること」を一括チェックできる (#146 M-3)。
  if (!Number.isFinite(expiresMs)) {
    return { ok: false, reason: "missing_expires" };
  }

  const expected = computeMagicLinkSignature({
    email: params.email,
    token: params.token,
    expires: expiresMs,
    secret: params.secret,
  });

  let providedBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    providedBuf = Buffer.from(params.sig, "base64url");
    expectedBuf = Buffer.from(expected, "base64url");
  } catch {
    return { ok: false, reason: "invalid_encoding" };
  }

  // timingSafeEqual は同一長でのみ呼べるため、長さ不一致は別 reason で弾く。
  // ただし、長さ不一致自体はほぼ実装ミスか改ざんであり情報価値は低い。
  if (providedBuf.length !== expectedBuf.length) {
    return { ok: false, reason: "length_mismatch" };
  }
  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}

/**
 * 環境変数から HMAC secret を取得する。未設定 / 空文字の場合は throw する (fail closed)。
 *
 * NEXTAUTH_SECRET と **別値** を強制するための明示的なチェック:
 * - ADMIN_MAGIC_LINK_HMAC_SECRET が未設定 → throw
 * - NEXTAUTH_SECRET と同一値 → 権限分離の意図に反するため throw
 *   (運用ミスを起動時に検出)
 */
export function getAdminMagicLinkHmacSecret(
  env: NodeJS.ProcessEnv = process.env
): string {
  const secret = env.ADMIN_MAGIC_LINK_HMAC_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error(
      "[magicLinkHmac] ADMIN_MAGIC_LINK_HMAC_SECRET is not set. " +
        "Set a dedicated secret (DO NOT reuse NEXTAUTH_SECRET)."
    );
  }
  if (secret === env.NEXTAUTH_SECRET) {
    throw new Error(
      "[magicLinkHmac] ADMIN_MAGIC_LINK_HMAC_SECRET must differ from NEXTAUTH_SECRET " +
        "(separation of duties; see #146)."
    );
  }
  return secret;
}
