import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 運営管理アプリ認証ミドルウェア (#145)
 *
 * Edge ランタイムで動作するため Prisma を使えない。AdminSession 行の存在検証は
 * Server Component / Route Handler 側 (getServerSession) の責務とし、ここでは
 * 「NextAuth セッション Cookie が存在するか」のみをチェックする。
 *
 * - Cookie 未設定 → /login へリダイレクト
 * - /login 配下と /api はミドルウェア対象外
 * - 旧実装 (`token.roles.includes("ADMIN")`) は JWT 戦略専用。Database 戦略に
 *   切り替えたため role チェックは Route Handler 側で getServerSession 経由で行う。
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // NextAuth v4 Database 戦略のセッション Cookie 名
  // - 開発: next-auth.session-token
  // - 本番 (HTTPS): __Secure-next-auth.session-token
  const sessionToken =
    request.cookies.get("next-auth.session-token") ??
    request.cookies.get("__Secure-next-auth.session-token");

  if (!sessionToken?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
