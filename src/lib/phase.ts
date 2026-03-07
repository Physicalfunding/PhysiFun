/**
 * フェーズ管理ユーティリティ
 *
 * リリースフェーズに応じてアクセス可能な機能を制御
 * - Phase 1: オーナー募集のみ（LP + 応募フォーム）
 * - Phase 2: オーナー機能（ログイン、プロジェクト管理）
 * - Phase 3: 一般公開（サポーター機能）
 */

export type ReleasePhase = 1 | 2 | 3;

/**
 * 現在のリリースフェーズを取得
 * 環境変数 NEXT_PUBLIC_RELEASE_PHASE から読み取る
 * 未設定の場合はデフォルトで Phase 1
 */
export function getCurrentPhase(): ReleasePhase {
  const phase = parseInt(process.env.NEXT_PUBLIC_RELEASE_PHASE || "1", 10);
  if (phase >= 1 && phase <= 3) {
    return phase as ReleasePhase;
  }
  return 1;
}

/**
 * 指定されたパスが現在のフェーズでアクセス可能かどうかを判定
 */
export function isPathAllowedInCurrentPhase(pathname: string): boolean {
  const phase = getCurrentPhase();
  return isPathAllowedInPhase(pathname, phase);
}

/**
 * 指定されたパスが指定されたフェーズでアクセス可能かどうかを判定
 */
export function isPathAllowedInPhase(pathname: string, phase: ReleasePhase): boolean {
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
 * 認証機能が有効かどうか（Phase 2 以上）
 */
export function isAuthEnabled(): boolean {
  return getCurrentPhase() >= 2;
}
