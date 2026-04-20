import { withAuth } from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
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
 * 型メモ (next-auth@^4.24.11, next@16.1.1):
 * - `withAuth` の戻り値は `NextMiddlewareWithAuth` (`req` に `nextauth.token` が生える
 *   拡張 NextRequest を受ける) だが、呼び出し側で通常の `NextRequest` を渡すだけで
 *   内部的に cookie から token を復元してくれるため、`NextRequest` を渡しても実行上は
 *   問題なく動く。
 * - 無理に `NextMiddleware` へキャストせず、`ReturnType<typeof withAuth>` で戻り値型を
 *   そのまま保持する (型キャストは使わない)。呼び出し側で `request as any` 等も避ける。
 *
 * CSRF を「認証前に」走らせる設計を維持したいので、`authorized` コールバック内で CSRF を
 * 混ぜる案は採用しない。ここでは withAuth を純粋に認証判定のみに使う。
 */
const authMiddleware: ReturnType<typeof withAuth> = withAuth(
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
  //
  // `withAuth` の戻り値シグネチャは `NextRequestWithAuth` (nextauth.token 付き) を
  // 要求するが、ここでは token を middleware 自身では使わないため (authorized
  // callback 側で判定する)、最低限の `nextauth` プロパティだけを補って渡す。
  // 実体の token は withAuth 内部で cookie から復元される。
  if (request.nextUrl.pathname.startsWith("/my")) {
    const reqWithAuth = Object.assign(request, {
      nextauth: { token: null },
    }) as NextRequestWithAuth;
    return authMiddleware(reqWithAuth, event);
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
