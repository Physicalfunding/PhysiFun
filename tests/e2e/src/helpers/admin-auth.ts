import { createHash, randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { prisma, signMagicLinkUrl } from "@physifun/infrastructure";
import { ADMIN_BASE_URL } from "../fixtures";

/**
 * apps/admin の Magic Link 認証フローを E2E から駆動するヘルパー (#150)
 *
 * 設計方針:
 * - メール送信 (Resend) は経由しない。`RESEND_API_KEY` 未設定時は NoopMailSender に
 *   フォールバックするため、`POST /api/auth/signin/email` がトークンを DB に作成しても
 *   実メールは飛ばない。
 * - 検証側の Magic Link URL は `signMagicLinkUrl` でテスト側でも組み立て、
 *   `tests/e2e` から `@physifun/infrastructure` を直接 import して再現する。
 * - HMAC secret は playwright.config.ts の `E2E_ADMIN_MAGIC_LINK_HMAC_SECRET` と
 *   一致している必要があるため、import 時に env から取り直す。
 *
 * ## NextAuth トークンハッシュ仕様
 * NextAuth v4 EmailProvider は `sendVerificationRequest` に渡す URL では生 token を
 * 使うが、DB (`createVerificationToken`) には `sha256(token + NEXTAUTH_SECRET)` を
 * ハッシュした値で保存する。コールバック時には URL の生 token を同じ式でハッシュして
 * DB と突合する。E2E で `POST /api/auth/signin/email` 経由で生成すると DB から
 * 取り出せるのはハッシュ済 token だけで、生 token は復元できない。そのため happy path
 * では `seedMagicLinkToken` で「生 token を test 側で生成 → ハッシュ済 token を直接
 * DB に INSERT」する経路を使い、URL には生 token を載せる。
 */

const E2E_NEXTAUTH_SECRET = "e2e-test-secret-do-not-use-in-production";
const E2E_ADMIN_MAGIC_LINK_HMAC_SECRET =
  "e2e-admin-magic-link-hmac-secret-do-not-use-in-production";
const E2E_CRON_SECRET = "e2e-cron-secret-do-not-use-in-production";

/**
 * NextAuth v4 EmailProvider の token ハッシュ処理を test 側で再現する。
 *
 * 参考: next-auth/core/lib/email/signin.ts
 *   `createHash("sha256").update(`${token}${secret}`).digest("hex")`
 */
function hashTokenForNextAuth(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

/**
 * E2E 用に AdminVerificationToken を直接 INSERT し、URL 用の生 token と expires を返す。
 *
 * NextAuth の signIn → sendVerificationRequest 経路を経由しないので、
 * rate limit / signIn callback の挙動はテスト対象から外れる (それらは spec 10 で検証)。
 */
export async function seedMagicLinkToken(params: {
  email: string;
  /** 既定: 5 分後 */
  expiresAt?: Date;
  /** NextAuth 側 secret を変えてテストしたいときに上書き */
  nextAuthSecret?: string;
}): Promise<{ rawToken: string; expires: Date }> {
  const identifier = params.email.trim().toLowerCase();
  const rawToken = randomBytes(32).toString("hex");
  const expires = params.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000);
  const secret = params.nextAuthSecret ?? E2E_NEXTAUTH_SECRET;
  const hashed = hashTokenForNextAuth(rawToken, secret);
  await prisma.adminVerificationToken.create({
    data: { identifier, token: hashed, expires },
  });
  return { rawToken, expires };
}

/**
 * NextAuth の CSRF トークンを取得し、`/api/auth/signin/email` に POST して
 * Magic Link メール送信フロー (= AdminVerificationToken 生成) を起動する。
 *
 * 戻り値: response status。NextAuth は signIn callback が false を返した場合も
 * 200 系で `?error=...` 付き URL を返すため、status だけでは成否を判定できない。
 * 呼び出し側は AdminVerificationToken の有無で判定する。
 */
export async function requestAdminMagicLink(
  request: APIRequestContext,
  email: string
): Promise<{ status: number; finalUrl: string }> {
  // 1. CSRF トークン取得 (NextAuth の signin endpoints は CSRF 必須)
  const csrfRes = await request.get(`${ADMIN_BASE_URL}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  // 2. signin/email POST (form-encoded)
  const res = await request.post(`${ADMIN_BASE_URL}/api/auth/signin/email`, {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      // NextAuth の CSRF cookie / Origin チェックに通すため
      origin: ADMIN_BASE_URL,
      referer: `${ADMIN_BASE_URL}/login`,
    },
    form: {
      email,
      csrfToken,
      callbackUrl: `${ADMIN_BASE_URL}/`,
      json: "true",
    },
    maxRedirects: 0,
  });
  return { status: res.status(), finalUrl: res.url() };
}

/**
 * DB から特定 email の AdminVerificationToken を最新の 1 件読み出す。
 *
 * NextAuth の AdminPrismaAdapter は `identifier=email` で row を作る (createVerificationToken)。
 * Magic Link クリック時に同じ identifier+token で findOne され、その後 deleteVerificationToken
 * で消費される。E2E では DB を直接読んで token / expires を取得する。
 */
export async function readLatestVerificationToken(email: string): Promise<{
  identifier: string;
  token: string;
  expires: Date;
} | null> {
  const row = await prisma.adminVerificationToken.findFirst({
    where: { identifier: email.trim().toLowerCase() },
    orderBy: { expires: "desc" },
  });
  return row;
}

/**
 * `tests/e2e` 側で署名済み Magic Link URL を組み立てる。
 *
 * NextAuth EmailProvider が生成する URL と同じ構造で `/api/auth/callback/email?...` を
 * 組み立て、`@physifun/infrastructure` の `signMagicLinkUrl` で `sig` / `sig_exp` を付与する。
 * これにより、メール送信を経由せずに本番と同じ検証経路を辿れる。
 */
export function buildMagicLinkUrl(params: {
  email: string;
  token: string;
  expires: Date;
  callbackUrl?: string;
  /** 署名 secret を上書きしたいケース (HMAC 失敗テスト) のためのオプション */
  secret?: string;
}): string {
  const callbackUrl = params.callbackUrl ?? `${ADMIN_BASE_URL}/`;
  const baseUrl =
    `${ADMIN_BASE_URL}/api/auth/callback/email` +
    `?callbackUrl=${encodeURIComponent(callbackUrl)}` +
    `&token=${encodeURIComponent(params.token)}` +
    `&email=${encodeURIComponent(params.email)}`;
  return signMagicLinkUrl({
    url: baseUrl,
    email: params.email,
    token: params.token,
    expires: params.expires,
    secret: params.secret ?? E2E_ADMIN_MAGIC_LINK_HMAC_SECRET,
  });
}

/** cron エンドポイント呼び出し用ヘッダ */
export function cronAuthHeader(): { authorization: string } {
  return { authorization: `Bearer ${E2E_CRON_SECRET}` };
}

export const E2E_ADMIN_HMAC_SECRET = E2E_ADMIN_MAGIC_LINK_HMAC_SECRET;
