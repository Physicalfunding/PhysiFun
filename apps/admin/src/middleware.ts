import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyCsrf } from "@/lib/csrf";

/**
 * 運営管理アプリ認証ミドルウェア (#145 / #166)
 *
 * ⚠️ このミドルウェアは **認証の最終防衛線ではない**。
 *   Edge ランタイムで動作するため Prisma を使えず、ここでは
 *   「NextAuth セッション Cookie が存在するか」だけしか確認できない。
 *   Cookie 値は暗号署名されていないため、任意の文字列で通過可能。
 *
 * 真の認可は Server Component / Route Handler 側で行う:
 *   - Server Component: `getServerSession(authOptions)` + AdminSession 検証
 *   - Route Handler:    `getAuthenticatedAdminId()` (apps/admin/src/lib/api/auth.ts)
 *                       が AdminSession 行と AdminAccount.status=ACTIVE を DB で確認
 *
 * このミドルウェアの責務はあくまで UX のため (未ログインで画面に来たら
 * /login へリダイレクトする) であり、セキュリティ境界は Route Handler / RSC 側にある。
 *
 * 今後このファイルに「role チェック」「権限チェック」等を追加してはならない。
 * 必ず Server 側で DB 検証付きで行うこと。
 *
 * 役割 (#166 で追加):
 * - `/api/*` の state-changing リクエスト (POST / PUT / PATCH / DELETE) に対する
 *   CSRF 検証 (Origin / Referer ヘッダーの同一オリジン確認)。
 *   NextAuth 自身のエンドポイント (`/api/auth/*`) は NextAuth 側が CSRF トークンを
 *   検証するためスキップする。
 *
 * - `/login` 配下と `/api/auth/*` 以外の `/api` は CSRF の対象。
 * - `/login` 配下とそれ以外のページは Cookie 存在チェックのみで認可は下流に委譲。
 * - 旧実装 (`token.roles.includes("ADMIN")`) は JWT 戦略専用。Database 戦略に
 *   切り替えたため role チェックは Route Handler 側で getServerSession 経由で行う。
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. `/api/*` の state-changing リクエストは CSRF 検証 (NextAuth 配下は除外)。
  //    Edge ランタイムで Cookie を読まずに Origin/Referer だけで判定する純関数。
  if (pathname.startsWith("/api/")) {
    const csrfResponse = verifyCsrf(request);
    if (csrfResponse) {
      return csrfResponse;
    }
    // API ルートは個別 Route Handler が認可を行うため、ここでは Cookie チェックしない。
    return NextResponse.next();
  }

  // 2. ログインページ自身は認証不要。
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // 3. それ以外 (運営ダッシュボード画面) は UX 上の未ログイン判定だけ行う。
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
