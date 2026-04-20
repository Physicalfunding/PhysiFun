import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
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
 * - CSRF チェックは `/api/*` のみに限定 (ページ遷移 `/my/*` は form POST しないため対象外)。
 *
 * @see https://next-auth.js.org/configuration/nextjs#middleware
 */

/**
 * `/my/*` 配下の認証チェック付きミドルウェア。
 * NextAuth の `withAuth` を利用し、token が無ければ自動でログインページにリダイレクトする。
 *
 * 型メモ: `withAuth` の戻り値は `(req, ev) => ...` の NextMiddleware 互換だが、
 * next-auth の型定義が若干ゆるく、拡張 req (`token` 付き) を前提とするため、
 * ここでは `NextMiddleware` として扱って通常の NextRequest 側から呼び出す。
 */
const authMiddleware: NextMiddleware = withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
) as unknown as NextMiddleware;

/**
 * Next.js middleware 本体。
 * CSRF を先に検証し、その後 `/my/*` のみ `withAuth` へ委譲する。
 */
export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  // 1. CSRF 検証は `/api/*` だけに限定する。
  //    (matcher で `/my/:path*` も拾っているが、これはページ遷移なので CSRF の対象にしない)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const csrfResponse = verifyCsrf(request);
    if (csrfResponse) {
      return csrfResponse;
    }
  }

  // 2. `/my/*` は認証必須。NextAuth の withAuth に委譲する。
  if (request.nextUrl.pathname.startsWith("/my")) {
    return authMiddleware(request, event);
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
