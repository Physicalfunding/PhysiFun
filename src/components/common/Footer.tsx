"use client";

import Link from "next/link";

/**
 * Footer
 * サイト共通フッターコンポーネント
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          {/* ロゴとコピーライト */}
          <div className="flex justify-center md:order-2">
            <Link href="/" className="text-gray-600 hover:text-orange-600 transition-colors">
              <span className="font-bold text-lg">Campfire Experience</span>
            </Link>
          </div>

          {/* フッターナビゲーション */}
          <div className="mt-4 md:mt-0 md:order-1">
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-700">
                プロジェクトを探す
              </Link>
              <Link href="/about" className="text-sm text-gray-500 hover:text-gray-700">
                サービスについて
              </Link>
              <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-700">
                利用規約
              </Link>
              <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-700">
                プライバシーポリシー
              </Link>
            </nav>
          </div>
        </div>

        {/* コピーライト */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            &copy; {currentYear} Campfire Experience. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
