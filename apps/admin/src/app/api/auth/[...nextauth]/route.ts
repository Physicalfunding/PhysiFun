import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  findAdminAccountIdByEmail,
  getAdminMagicLinkHmacSecret,
  verifyMagicLinkSignature,
  writeAdminAuditLog,
  MAGIC_LINK_SIGNATURE_PARAM,
  MAGIC_LINK_EXPIRES_PARAM,
} from "@physifun/infrastructure";
import { authOptions } from "@/lib/auth";

/**
 * 運営管理アプリ用 NextAuth.js API ルートハンドラ
 *
 * ## HMAC 検証 (#146)
 * NextAuth の default handler へ渡す前に、マジックリンクのコールバック URL
 * (`/api/auth/callback/email?callbackUrl=...&token=...&email=...&sig=...&sig_exp=...`)
 * の署名を検証する。不正な `sig` / `sig_exp` の場合は:
 *
 *   1. NextAuth handler を呼ばずに 400 (AccessDenied) へリダイレクト
 *      → `admin_verification_tokens` が **消費されない** (secret を知らない
 *        攻撃者は本物の token でも検証 URL を通せない)
 *   2. AdminAuditLog に `magic_link.signature_invalid` を記録
 *
 * ## なぜ middleware ではなく route で
 * middleware は Edge ランタイムで動くため @physifun/infrastructure (Prisma 依存)
 * を読み込めない。したがって route handler の入口で verify を差し込む。
 *
 * ## 検証対象
 * - method === "GET"
 * - path の末尾が `/api/auth/callback/email`
 *   - `/api/auth/signin/email` (POST) は送信側であり token は生成前のため対象外
 *   - `/api/auth/signin`, `/api/auth/session` など NextAuth 内部経路も対象外
 */
const handler = NextAuth(authOptions);

const CALLBACK_EMAIL_PATH_SUFFIX = "/api/auth/callback/email";

/** 検証失敗時のリダイレクト先 (AccessDenied で /login に戻す) */
function accessDeniedRedirect(request: NextRequest): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", "AccessDenied");
  return NextResponse.redirect(url);
}

async function verifyMagicLinkOrReject(request: NextRequest): Promise<NextResponse | null> {
  const url = new URL(request.url);
  // 末尾スラッシュのゆらぎを吸収
  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname.endsWith(CALLBACK_EMAIL_PATH_SUFFIX)) {
    return null;
  }

  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");
  const sig = url.searchParams.get(MAGIC_LINK_SIGNATURE_PARAM);
  const sigExp = url.searchParams.get(MAGIC_LINK_EXPIRES_PARAM);

  // NextAuth の email callback は token / email 必須。欠けていれば
  // NextAuth 本体のエラー経路に任せても良いが、ここでは署名検証の
  // 前提条件が満たされないケースとして同じ拒否フローに寄せる。
  if (!token || !email) {
    await recordSignatureInvalid({
      email,
      reason: "missing_token_or_email",
    });
    return accessDeniedRedirect(request);
  }

  let secret: string;
  try {
    secret = getAdminMagicLinkHmacSecret();
  } catch (e) {
    // secret 未設定は fail closed。起動時 (sendVerificationRequest 経路) にも
    // 検出されるが、callback 経路でも念のため弾く。
    // メッセージには環境変数名が含まれるため (内部構成の露出防止のため) DB には
    // 固定 reason のみ残し、詳細は console.error に出す (#146 M-2)。
    const message = e instanceof Error ? e.message : String(e);
    console.error("[magic-link] secret unavailable", { error: message });
    await recordSignatureInvalid({ email, reason: "secret_unavailable" });
    return accessDeniedRedirect(request);
  }

  const result = verifyMagicLinkSignature({
    email,
    token,
    sig,
    sigExpires: sigExp,
    secret,
  });
  if (!result.ok) {
    await recordSignatureInvalid({ email, reason: result.reason });
    return accessDeniedRedirect(request);
  }
  return null;
}

/**
 * AdminAuditLog に `magic_link.signature_invalid` を記録する。
 *
 * - 失敗した時点では AdminAccount が特定できない可能性がある
 *   (email が未登録 / 改ざんされている等)。AdminAuditLog は
 *   `adminAccountId` が FK required のため、匿名記録専用の
 *   仮想 AdminAccount を作るのは過剰設計。
 *   → 書き込み失敗しても「リダイレクト自体」は行えるよう、log-and-continue する。
 *   → AdminAccount 解決は email → findUnique(status=ACTIVE) で試み、
 *      特定できないときは何も書かず console.warn のみに留める。
 */
async function recordSignatureInvalid(params: {
  email: string | null;
  reason: string;
}): Promise<void> {
  try {
    const email = params.email?.trim().toLowerCase();
    if (!email) {
      console.warn("[magic-link] signature invalid (no email on URL)", {
        reason: params.reason,
      });
      return;
    }
    // AdminAccount を解決できる場合のみ監査ログに残す (FK 制約のため)。
    // 解決できないケース (未登録 email への改ざん試行等) は console.warn のみ。
    // `infrastructure/` 以外で prisma を直接触らない方針 (CLAUDE.md) に揃えるため、
    // email → id 解決は `findAdminAccountIdByEmail` 経由で行う (#146 B-1)。
    const adminId = await findAdminAccountIdByEmail(email);
    if (!adminId) {
      console.warn("[magic-link] signature invalid for unknown email", {
        email,
        reason: params.reason,
      });
      return;
    }
    await writeAdminAuditLog({
      adminAccountId: adminId,
      action: "magic_link.signature_invalid",
      targetType: "AdminAccount",
      targetId: adminId,
      metadata: {
        reason: params.reason,
      },
    });
  } catch (e) {
    // 監査ログ書き込み失敗でも拒否レスポンスは返したいので swallow。
    const message = e instanceof Error ? e.message : String(e);
    console.error("[magic-link] failed to record signature_invalid audit log", {
      error: message,
    });
  }
}

/**
 * GET ハンドラ: callback/email への GET のみ署名検証を噛ませ、
 * それ以外は NextAuth default に委譲する。
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
): Promise<Response> {
  const rejection = await verifyMagicLinkOrReject(request);
  if (rejection) return rejection;
  // NextAuth v4 の handler は (req, ctx) を受け付ける。
  return handler(request, context);
}

/**
 * POST: 署名生成前の signin/email など。NextAuth にそのまま委譲する。
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
): Promise<Response> {
  return handler(request, context);
}
