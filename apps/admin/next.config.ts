import type { NextConfig } from "next";

/**
 * 運営管理アプリ Next.js 設定
 *
 * Issue #120:
 * - 審査画面のカバー画像表示で `next/image` を使うため、web 側と同じ
 *   ポリシーで Supabase Storage ホストを許可する。
 * - ランタイムでは `@physifun/ui-shared` の `isAllowedImageUrl` が二重の
 *   allowlist + SSRF 防御を行う。
 */
const isDevelopment = process.env.NODE_ENV === "development";

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
  {
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "https",
    hostname: "images.unsplash.com",
  },
];

if (envSupabaseHost && !envSupabaseHost.endsWith(".supabase.co")) {
  remotePatterns.push({
    protocol: "https",
    hostname: envSupabaseHost,
    pathname: "/storage/v1/object/public/**",
  });
}

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
    unoptimized: isDevelopment,
    remotePatterns,
  },
};

export default nextConfig;
