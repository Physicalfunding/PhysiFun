import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * フェーズ管理 + 認証ミドルウェア
 *
 * 1. フェーズに応じてアクセス可能なルートを制御
 * 2. 認証が必要なルートへのアクセスを制御
 *
 * @see https://next-auth.js.org/configuration/nextjs#middleware
 */

type ReleasePhase = 1 | 2 | 3;

/**
 * 現在のリリースフェーズを取得
 */
function getCurrentPhase(): ReleasePhase {
  const phase = parseInt(process.env.NEXT_PUBLIC_RELEASE_PHASE || "1", 10);
  if (phase >= 1 && phase <= 3) {
    return phase as ReleasePhase;
  }
  return 1;
}

/**
 * フェーズに応じてパスが許可されているかを判定
 */
function isPathAllowedInPhase(pathname: string, phase: ReleasePhase): boolean {
  // Phase 1: LP と応募フォームのみ
  const phase1Paths = ["/", "/apply"];

  // Phase 2: Phase 1 + 認証 + オーナー機能
  const phase2Paths = [...phase1Paths, "/login", "/register", "/my/project", "/my/profile"];

  // Phase 3: 全ページ許可
  if (phase >= 3) {
    return true;
  }

  // 静的ファイル、API、_next は常に許可
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return true;
  }

  if (phase === 1) {
    return phase1Paths.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/")));
  }

  if (phase === 2) {
    return phase2Paths.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/")));
  }

  return false;
}

/**
 * フェーズ制御ミドルウェア（認証不要のルート用）
 */
function phaseMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const phase = getCurrentPhase();

  // フェーズで許可されていないパスはトップページにリダイレクト
  if (!isPathAllowedInPhase(pathname, phase)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

/**
 * 認証ミドルウェア（/my/* 用）
 * Phase 2 以上でのみ動作
 */
const authMiddleware = withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // ホスト専用ページへのアクセス制御
    if (pathname.startsWith("/my/project")) {
      if (token?.userType !== "HOST") {
        // ホスト権限がない場合はホームへリダイレクト
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // 認証が必要かどうかの判定
      authorized: ({ token }) => {
        // トークンが存在すれば認証済み
        return !!token;
      },
    },
  }
);

/**
 * メインミドルウェア
 * フェーズとパスに応じて適切なミドルウェアを適用
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const phase = getCurrentPhase();

  // フェーズで許可されていないパスはリダイレクト
  if (!isPathAllowedInPhase(pathname, phase)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Phase 2 以上で /my/* へのアクセスは認証ミドルウェアを適用
  if (phase >= 2 && pathname.startsWith("/my")) {
    // @ts-expect-error - withAuth の型定義と実際の使用方法の差異
    return authMiddleware(request);
  }

  return NextResponse.next();
}

/**
 * ミドルウェアを適用するパス
 * 全てのパスでフェーズチェックを行う
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)",
  ],
};
