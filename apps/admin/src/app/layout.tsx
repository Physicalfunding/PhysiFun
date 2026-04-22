import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "フィジファン 運営管理",
  description: "フィジファン 運営管理画面",
  // 運営管理アプリは検索エンジンにインデックスさせない (#147 Nit-2)。
  // middleware / Vercel 側の `X-Robots-Tag: noindex, nofollow` ヘッダと
  // 二重防衛の意味でここでも meta robots を明示する。
  robots: { index: false, follow: false },
};

// NOTE (#119): `layout.tsx` は state を持たない前提のため `force-dynamic` は宣言しない。
// 将来ここで動的データ取得 (認証ユーザー情報の埋め込み等) を始める場合は、
// 各 page.tsx と同様に `export const dynamic = "force-dynamic"` を追加する。

/**
 * 運営管理アプリのルートレイアウト
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
