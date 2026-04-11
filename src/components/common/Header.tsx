"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

/**
 * Header
 * サイト共通ヘッダーコンポーネント
 *
 * 新 Phase 1（リーダー募集 + リーダー機能）時点の表示:
 * - ロゴ（`/`）
 * - リーダー応募リンク（非ログイン時、`/apply`）
 * - ログインリンク（非ログイン時、`/login`）
 * - ログイン済み時: プロフィール / マイプロジェクト / ログアウトのドロップダウン
 */
export function Header() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <header className="bg-white shadow-sm">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* ロゴ */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <Image
                src="/images/symbol-black.png"
                alt="フィジファン"
                width={40}
                height={40}
                className="h-10 w-auto"
              />
            </Link>
          </div>

          {/* デスクトップナビゲーション */}
          <div className="hidden sm:flex sm:items-center sm:space-x-4">
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
                    <Link
                      href="/my/project"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      マイプロジェクト
                    </Link>
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
                  href="/apply"
                  className="rounded-md bg-physifun-red px-4 py-2 text-sm font-medium text-white hover:bg-physifun-red-light"
                >
                  リーダー応募
                </Link>
              </div>
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
              {session ? (
                <>
                  <Link
                    href="/my/profile"
                    className="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    プロフィール
                  </Link>
                  <Link
                    href="/my/project"
                    className="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    マイプロジェクト
                  </Link>
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
                    href="/apply"
                    className="block px-3 py-2 text-base font-medium text-physifun-red hover:bg-gray-50"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    リーダー応募
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
