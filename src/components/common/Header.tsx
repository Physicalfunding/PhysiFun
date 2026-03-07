"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

/**
 * 現在のリリースフェーズを取得
 * Phase 1: オーナー募集のみ
 * Phase 2: オーナー機能
 * Phase 3: 一般公開
 */
function getCurrentPhase(): number {
  const phase = parseInt(process.env.NEXT_PUBLIC_RELEASE_PHASE || "1", 10);
  return phase >= 1 && phase <= 3 ? phase : 1;
}

/**
 * Header
 * サイト共通ヘッダーコンポーネント
 *
 * フェーズに応じて表示を切り替え:
 * - Phase 1: ロゴ + オーナー応募リンクのみ
 * - Phase 2+: 認証状態に応じたナビゲーション
 */
export function Header() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const phase = getCurrentPhase();

  // 認証機能が有効か（Phase 2 以上）
  const isAuthEnabled = phase >= 2;

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <header className="bg-white shadow-sm">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* ロゴ */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl font-bold text-orange-600">
              フィジファン
            </Link>
          </div>

          {/* ナビゲーション */}
          <div className="hidden sm:flex sm:items-center sm:space-x-4">
            {/* Phase 1: オーナー応募リンクのみ */}
            {phase === 1 && (
              <Link
                href="/apply"
                className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
              >
                オーナー応募
              </Link>
            )}

            {/* Phase 2+: プロジェクトを探すリンク */}
            {phase >= 2 && (
              <Link
                href="/projects"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                プロジェクトを探す
              </Link>
            )}

            {/* Phase 2+: 認証状態に応じた表示 */}
            {isAuthEnabled && (
              <>
                {status === "loading" ? (
                  <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
                ) : session ? (
                  <div className="relative">
                    <button
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
                      aria-expanded={isMenuOpen}
                      aria-haspopup="true"
                    >
                      <span className="text-sm font-medium">{session.user?.name}</span>
                      <svg
                        className={`h-5 w-5 transition-transform ${isMenuOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* ドロップダウンメニュー */}
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                        <Link
                          href="/my/profile"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          プロフィール
                        </Link>
                        {/* ホストの場合のみ表示 */}
                        {session.user?.userType === "HOST" && (
                          <Link
                            href="/my/project"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            マイプロジェクト
                          </Link>
                        )}
                        {/* ゲストの場合のみ表示（Phase 3+） */}
                        {phase >= 3 && session.user?.userType === "GUEST" && (
                          <Link
                            href="/my/participations"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            参加予定
                          </Link>
                        )}
                        {/* メッセージ（Phase 3+） */}
                        {phase >= 3 && (
                          <Link
                            href="/my/messages"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            メッセージ
                          </Link>
                        )}
                        <hr className="my-1" />
                        <button
                          onClick={handleSignOut}
                          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                        >
                          ログアウト
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                    <Link
                      href="/login"
                      className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                    >
                      ログイン
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
                    >
                      新規登録
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* モバイルメニューボタン */}
          <div className="sm:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">メニューを開く</span>
              {isMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* モバイルメニュー */}
        {isMenuOpen && (
          <div className="sm:hidden">
            <div className="space-y-1 pb-3 pt-2">
              {/* Phase 1: オーナー応募リンクのみ */}
              {phase === 1 && (
                <Link
                  href="/apply"
                  className="block px-3 py-2 text-base font-medium text-orange-600 hover:bg-gray-50"
                  onClick={() => setIsMenuOpen(false)}
                >
                  オーナー応募
                </Link>
              )}

              {/* Phase 2+: プロジェクトを探す */}
              {phase >= 2 && (
                <Link
                  href="/projects"
                  className="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  onClick={() => setIsMenuOpen(false)}
                >
                  プロジェクトを探す
                </Link>
              )}

              {/* Phase 2+: 認証関連 */}
              {isAuthEnabled && (
                <>
                  {session ? (
                    <>
                      <Link
                        href="/my/profile"
                        className="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        プロフィール
                      </Link>
                      {/* ホストの場合のみ表示 */}
                      {session.user?.userType === "HOST" && (
                        <Link
                          href="/my/project"
                          className="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          マイプロジェクト
                        </Link>
                      )}
                      {/* ゲストの場合のみ表示（Phase 3+） */}
                      {phase >= 3 && session.user?.userType === "GUEST" && (
                        <Link
                          href="/my/participations"
                          className="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          参加予定
                        </Link>
                      )}
                      {/* メッセージ（Phase 3+） */}
                      {phase >= 3 && (
                        <Link
                          href="/my/messages"
                          className="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          メッセージ
                        </Link>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="block w-full px-3 py-2 text-left text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      >
                        ログアウト
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        ログイン
                      </Link>
                      <Link
                        href="/register"
                        className="block px-3 py-2 text-base font-medium text-orange-600 hover:bg-gray-50"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        新規登録
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
