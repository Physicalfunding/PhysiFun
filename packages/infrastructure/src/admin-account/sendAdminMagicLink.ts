import type { SendVerificationRequestParams } from "next-auth/providers/email";
import type { MailSender } from "../mail/types";
import { signMagicLinkUrl } from "./magicLinkHmac";

/**
 * NextAuth EmailProvider 用マジックリンク送信関数 (#145 / #159 M-4 拡張 / #146)
 *
 * apps/admin 側の auth.ts が EmailProvider の `sendVerificationRequest` として
 * このファクトリを呼び出す。nodemailer を使わず、既存の `MailSender`
 * (ResendMailSender) 経由で送信することで依存を最小化する。
 *
 * - 送信先は `email` (AdminAccount.email と一致するはず) 単一
 * - 件名 / 本文は日本語固定 (運営管理アプリのみが利用)
 * - マジックリンクの URL は NextAuth が params.url で組み立てた URL に
 *   HMAC-SHA256 署名 (`sig` / `sig_exp` クエリ) を付与する (#146)
 * - 有効期限 (分) は deps で受け取る。apps/admin 側の `EMAIL_MAGIC_LINK_MAX_AGE_MIN`
 *   と揃えることで、NextAuth の maxAge / UI 文言 / メール本文の三者が
 *   単一の定数から駆動される (#159 M-4 拡張)。infrastructure は apps/admin を
 *   直接 import できないため DI 経由で渡す。
 *
 * ## HMAC 署名 (#146)
 * NextAuth EmailProvider が生成する URL は `token` クエリのみに依存しており、
 * `token` が漏洩した場合に consume できてしまう。権限分離された
 * `ADMIN_MAGIC_LINK_HMAC_SECRET` で URL 全体を署名することで、token 漏洩単体
 * では consume できない構造にする (Defense in depth)。secret は DI で受け取る。
 */
export interface CreateSendAdminMagicLinkDeps {
  mailSender: MailSender;
  /** マジックリンクの有効期限 (分)。メール本文に「N 分以内に〜」として差し込む。 */
  expiresInMin: number;
  /**
   * HMAC-SHA256 署名に使う secret (#146)。
   * apps/admin 側の DI で `ADMIN_MAGIC_LINK_HMAC_SECRET` を解決して渡す。
   * 未設定時は DI 層で throw されるため、ここに来る時点で空文字は許容しない。
   */
  hmacSecret: string;
}

export function createSendAdminMagicLink(deps: CreateSendAdminMagicLinkDeps) {
  return async function sendAdminMagicLink(params: SendVerificationRequestParams): Promise<void> {
    const { identifier: email, url, expires } = params;

    // NEXTAUTH_URL が誤設定/悪意ある値になった場合に javascript: / data: などの
    // 危険スキームをメール本文に載せないための保険 (#157 H1)。
    // NextAuth 本体も通常は http(s) URL を生成するが、自衛のため明示的に検査する。
    assertHttpUrl(url);

    // #146: URL に HMAC-SHA256 署名 (`sig`) と署名対象の expires (`sig_exp`) を付ける。
    // NextAuth 既存のクエリ (`token`, `email`, `callbackUrl`) は保持し、末尾に追加するのみ。
    // NextAuth は URL に `token` クエリを必ず載せる仕様だが、アップストリーム実装変更で
    // 欠落した場合に empty string で署名してしまうと、攻撃者は token 無しの URL でも
    // 署名検証を通せてしまう余地が生まれる (後続のセキュリティチェックには依存しない
    // fail-fast にする / #146 m-4)。そのため token 欠落は明示的に throw する。
    const tokenFromUrl = new URL(url).searchParams.get("token");
    if (!tokenFromUrl) {
      throw new Error(
        "[sendAdminMagicLink] magic link URL does not contain `token` query (NextAuth contract violated)"
      );
    }
    const signedUrl = signMagicLinkUrl({
      url,
      email,
      token: tokenFromUrl,
      expires,
      secret: deps.hmacSecret,
    });

    const expiresJst = formatJstDateTime(expires);
    const minutes = deps.expiresInMin;

    const subject = "【PhysiFun 運営管理】ログイン用リンク";
    const text = [
      "PhysiFun 運営管理アプリのログインリンクです。",
      "",
      `下記 URL を ${minutes} 分以内にブラウザで開いてください:`,
      signedUrl,
      "",
      `このリンクは ${expiresJst} まで有効です。`,
      "心当たりがない場合は、このメールは破棄してください。",
      "",
      "— PhysiFun 運営",
    ].join("\n");

    const html = [
      "<p>PhysiFun 運営管理アプリのログインリンクです。</p>",
      `<p>下記ボタンを ${minutes} 分以内にクリックしてください:</p>`,
      `<p><a href="${escapeHtml(signedUrl)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:4px;">ログインする</a></p>`,
      `<p>うまく動作しない場合は以下の URL をブラウザに貼り付けてください:<br><a href="${escapeHtml(signedUrl)}">${escapeHtml(signedUrl)}</a></p>`,
      `<p style="color:#6b7280;font-size:12px;">このリンクは ${escapeHtml(expiresJst)} まで有効です。心当たりがない場合は破棄してください。</p>`,
      '<p style="color:#6b7280;font-size:12px;">— PhysiFun 運営</p>',
    ].join("\n");

    const result = await deps.mailSender.send({
      to: email,
      subject,
      text,
      html,
    });

    if (!result.ok) {
      // NextAuth は throw されたエラーをログに出し signIn は `?error=EmailSignin` で戻す。
      throw new Error(`[sendAdminMagicLink] mail send failed: ${result.error.message}`);
    }
  };
}

/**
 * マジックリンク URL が http:// または https:// で始まる安全な URL であることを検証する。
 * それ以外 (javascript:, data:, vbscript: など) は即 throw。
 *
 * URL パース自体が失敗するケース (相対パス、空文字列) も弾く。
 */
function assertHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[sendAdminMagicLink] invalid magic link URL (not a URL)`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `[sendAdminMagicLink] disallowed URL scheme: ${parsed.protocol} (http/https only)`
    );
  }
}

// 日時フォーマッタ (#158 L3)
// 以前は手作りの UTC+9 加算で日時を組み立てていたが、Intl.DateTimeFormat に寄せて
// タイムゾーン計算・ゼロ埋め・ロケールを標準ライブラリに委譲する。
const JST_DATETIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatJstDateTime(date: Date): string {
  // Intl の "ja-JP" 出力例: "2026/04/21 12:34" → 既存と揃えるためハイフン区切りに正規化し JST 接尾辞を付ける。
  const parts = JST_DATETIME_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hh = get("hour");
  const mm = get("minute");
  return `${y}-${m}-${d} ${hh}:${mm} JST`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
