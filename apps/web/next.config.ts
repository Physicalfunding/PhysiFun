import type { NextConfig } from "next";

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
 *
 * @see https://nextjs.org/docs/app/api-reference/next-config-js
 */
const isDevelopment = process.env.NODE_ENV === "development";

/**
 * `NEXT_PUBLIC_SUPABASE_URL` からホスト名を抽出する。
 * 例: `https://abcxyz.supabase.co` → `abcxyz.supabase.co`
 */
function resolveEnvSupabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const envSupabaseHost = resolveEnvSupabaseHost();

const remotePatterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
  // Supabase Storage 本番（ワイルドカード）
  {
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  // Unsplash（モック画像用）
  {
    protocol: "https",
    hostname: "images.unsplash.com",
  },
];

// 環境変数から Supabase ホストを読み、`*.supabase.co` に該当しない独自ドメインも許可する。
// 同一ホストが既に `*.supabase.co` でカバーされている場合も重複許可は無害。
if (envSupabaseHost && !envSupabaseHost.endsWith(".supabase.co")) {
  remotePatterns.push({
    protocol: "https",
    hostname: envSupabaseHost,
    pathname: "/storage/v1/object/public/**",
  });
}

// 開発環境のみローカル Supabase Storage を許可
if (isDevelopment) {
  remotePatterns.push(
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
    }
  );
}

const nextConfig: NextConfig = {
  images: {
    // 開発環境では Next.js の画像最適化を無効化（プライベート IP 最適化の回避）
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
