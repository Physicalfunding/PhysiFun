import type { NextConfig } from "next";
import { buildImageRemotePatterns } from "@physifun/ui-shared";

/**
 * Next.js 設定
 *
 * パフォーマンス最適化:
 * - 画像最適化（remotePatterns）
 * - 静的ページ生成の最適化
 *
 * Issue #120:
 * - カバー画像は `next/image` 経由で表示する。
 * - remotePatterns は Supabase Storage（`*.supabase.co`）と Unsplash
 *   （モック画像）を許可。加えて `NEXT_PUBLIC_SUPABASE_URL` が独自ドメインを
 *   指す場合も動的に許可する。
 * - ランタイムでは `@physifun/ui-shared` の `isAllowedImageUrl` が同等の
 *   allowlist + SSRF 防御を行い、二重化する。
 * - apps/web と apps/admin の remotePatterns ロジックは
 *   `@physifun/ui-shared/config/imageRemotePatterns` に集約している。
 *
 * @see https://nextjs.org/docs/app/api-reference/next-config-js
 */
const isDevelopment = process.env.NODE_ENV === "development";

const remotePatterns = buildImageRemotePatterns({
  env: process.env.NEXT_PUBLIC_SUPABASE_URL,
  isDevelopment,
});

const nextConfig: NextConfig = {
  images: {
    // 開発環境では Next.js の画像最適化を無効化する（プライベート IP 最適化の
    // 回避、ローカル Supabase Storage の読み込み対応のため）。
    //
    // SSRF に関する注意:
    // dev では next/image の server-side 最適化がバイパスされるため、
    // `remotePatterns` によるサーバーサイド fetch ガードは効かない。
    // dev 時のクライアント側 SSRF 防御層は `@physifun/ui-shared` の
    // `isAllowedImageUrl` が唯一の防御となる（production では remotePatterns
    // との 2 重防御）。
    unoptimized: isDevelopment,
    remotePatterns,
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  experimental: {
    // Partial Prerendering（将来的に有効化）
    // ppr: true,
  },
};

export default nextConfig;
