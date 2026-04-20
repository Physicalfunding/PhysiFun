import type { NextConfig } from "next";
import { buildImageRemotePatterns } from "@physifun/ui-shared";

/**
 * 運営管理アプリ Next.js 設定
 *
 * Issue #120:
 * - 審査画面のカバー画像表示で `next/image` を使うため、web 側と同じ
 *   ポリシーで Supabase Storage ホストを許可する。
 * - ランタイムでは `@physifun/ui-shared` の `isAllowedImageUrl` が二重の
 *   allowlist + SSRF 防御を行う。
 * - remotePatterns ロジックは apps/web と共通化し
 *   `@physifun/ui-shared/config/imageRemotePatterns` に集約している。
 */
const isDevelopment = process.env.NODE_ENV === "development";

const remotePatterns = buildImageRemotePatterns({
  env: process.env.NEXT_PUBLIC_SUPABASE_URL,
  isDevelopment,
});

const nextConfig: NextConfig = {
  images: {
    // SSRF に関する注意:
    // dev では next/image の最適化が無効化されるため `remotePatterns` の
    // サーバーサイド fetch ガードは効かない。`isAllowedImageUrl` がクライアント
    // 側の唯一の SSRF 防御層となる。
    unoptimized: isDevelopment,
    remotePatterns,
  },
};

export default nextConfig;
