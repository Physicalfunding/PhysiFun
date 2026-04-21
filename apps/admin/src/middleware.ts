import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 運営管理アプリ認証ミドルウェア (#145)
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
 * - Cookie 未設定 → /login へリダイレクト
 * - /login 配下と /api はミドルウェア対象外 (API は各 Route Handler が守る)
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
