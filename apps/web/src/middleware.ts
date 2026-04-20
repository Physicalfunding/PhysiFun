import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyCsrf } from "@/lib/csrf";

/**
 * Middleware エントリポイント
 *
 * 役割:
 * 1. `/api/*` の state-changing リクエスト (POST / PUT / PATCH / DELETE) に対する
 *    CSRF 検証 (Origin / Referer ヘッダーの同一オリジン確認)。
 *    NextAuth 自身のエンドポイント (`/api/auth/*`) は NextAuth 側が CSRF トークンを
 *    検証するためスキップする。
 * 2. `/my/*` 配下の認証必須ルートに対する NextAuth 認証チェック。
 *
 * 実装メモ:
 * - `/my/*` のみ `withAuth` を適用するため、パスに応じて適用を分岐している。
 * - CSRF チェックはすべての matcher 対象で最初に走らせる (認証前でも拒否して問題ない)。
 *
 * @see https://next-auth.js.org/configuration/nextjs#middleware
 */

/**
 * `/my/*` 配下の認証チェック付きミドルウェア。
 * NextAuth の `withAuth` を利用し、token が無ければ自動でログインページにリダイレクトする。
 */
const authMiddleware = withAuth(
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
 * Next.js middleware 本体。
 * CSRF を先に検証し、その後 `/my/*` のみ `withAuth` へ委譲する。
 */
export default async function middleware(request: NextRequest) {
  // 1. CSRF 検証 (safe methods と `/api/auth/*` は内部でスキップされる)
  const csrfResponse = verifyCsrf(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  // 2. `/my/*` は認証必須。NextAuth の withAuth に委譲する。
  if (request.nextUrl.pathname.startsWith("/my")) {
    // NextAuth の withAuth は (req, ev) シグネチャで呼ばれるため、そのまま委譲する。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (authMiddleware as unknown as (req: NextRequest) => any)(request);
  }

  return NextResponse.next();
}

/**
 * ミドルウェアを適用するパス。
 *
 * - `/my/:path*`: 認証必須ルート (withAuth)
 * - `/api/:path*`: CSRF 検証対象ルート
 *
 * 公開ページ (LP / 応募フォーム / サインイン等) には適用しない。
 */
export const config = {
  matcher: ["/my/:path*", "/api/:path*"],
};
