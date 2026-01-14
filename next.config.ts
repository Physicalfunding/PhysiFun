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
const nextConfig: NextConfig = {
  // 画像最適化の設定
  // Supabase Storage から画像を読み込む場合に必要
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
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
