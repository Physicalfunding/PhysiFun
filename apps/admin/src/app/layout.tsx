import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "フィジファン 運営管理",
  description: "フィジファン 運営管理画面",
};

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
