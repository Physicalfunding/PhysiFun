import type { NextConfig } from "next";

/**
 * Next.js 設定
 *
 * パフォーマンス最適化:
 * - 画像最適化（remotePatterns）
 * - 静的ページ生成の最適化
 *
 * @see https://nextjs.org/docs/app/api-reference/next-config-js
 */
// 開発環境かどうかを判定
const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // 画像最適化の設定
  // Supabase Storage から画像を読み込む場合に必要
  images: {
    // 開発環境ではNext.jsの画像最適化を無効化（プライベートIPへのアクセス制限を回避）
    // 本番環境では最適化を有効にする
    unoptimized: isDevelopment,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // ローカル開発用 Supabase Storage
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // 画像フォーマットの最適化
    formats: ["image/avif", "image/webp"],
    // デバイスサイズの指定（レスポンシブ画像用）
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // 画像サイズの指定
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // 実験的な機能（将来的に有効化）
  experimental: {
    // Partial Prerendering（将来的に有効化）
    // ppr: true,
  },
};

export default nextConfig;
