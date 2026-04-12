import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 運営管理アプリ認証ミドルウェア
 *
 * 全ページで ADMIN ロールを必須とする。
 * - セッションがなければ /login へリダイレクト
 * - ログイン済みでも ADMIN ロールがなければ /login へリダイレクト
 * - /login と /api パスはミドルウェアから除外
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /login と /api はミドルウェアの対象外
  if (pathname.startsWith("/login") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // 未ログイン → /login へリダイレクト
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ADMIN ロールチェック
  // TODO: token.roles が実装されたら有効化する
  // JWT に roles が保存されるようになったら以下を有効化:
  // const roles = (token.roles as string[]) ?? [];
  // if (!roles.includes("ADMIN")) {
  //   const loginUrl = new URL("/login", request.url);
  //   loginUrl.searchParams.set("error", "unauthorized");
  //   return NextResponse.redirect(loginUrl);
  // }

  return NextResponse.next();
}

/**
 * ミドルウェアを適用するパス
 *
 * 静的アセットと Next.js 内部パスを除外する。
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
