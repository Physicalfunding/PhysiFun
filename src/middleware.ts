import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * 認証ミドルウェア
 * @see https://next-auth.js.org/configuration/nextjs#middleware
 *
 * 保護されたルートへのアクセスを制御:
 * - /my/* - マイページ（認証必須）
 *
 * 未認証ユーザーは自動的にログインページへリダイレクト
 */
export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // ホスト専用ページへのアクセス制御
    if (pathname.startsWith("/my/project")) {
      if (token?.userType !== "HOST" && token?.userType !== "BOTH") {
        // ホスト権限がない場合はホームへリダイレクト
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // 認証が必要かどうかの判定
      authorized: ({ token, req }) => {
        // トークンが存在すれば認証済み
        return !!token;
      },
    },
  }
);

/**
 * ミドルウェアを適用するパス
 * /my/* 以下のすべてのルートで認証を要求
 */
export const config = {
  matcher: ["/my/:path*"],
};
