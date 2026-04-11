import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * 認証ミドルウェア
 *
 * `/my/*` 配下は認証必須。未ログインなら NextAuth のログインページへリダイレクトする。
 *
 * @see https://next-auth.js.org/configuration/nextjs#middleware
 */
export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

/**
 * ミドルウェアを適用するパス
 *
 * `/my/*` のみを対象とする。トップページや `/apply` 等の公開ルートには適用しない。
 */
export const config = {
  matcher: ["/my/:path*"],
};
