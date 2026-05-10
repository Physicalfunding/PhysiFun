import type { NextConfig } from "next";
import path from "node:path";
// `@physifun/ui-shared` の index 経由だと SafeSnsLink.tsx (JSX) を巻き込むため、
// `next.config.ts` ローダ (Node, JSX 非対応) がビルドに失敗する。
// JSX を含まない純粋な設定モジュールのみを subpath export から読み込む。
import { buildImageRemotePatterns } from "@physifun/ui-shared/config/image-remote-patterns";

// monorepo root（`apps/web` から 2 階層上）。
// `/Users/.../github/package.json` のような無関係な親 package.json を
// Turbopack が workspace root と誤検出して node_modules 解決が壊れるのを防ぐ。
const monorepoRoot = path.join(__dirname, "..", "..");

/**
 * Next.js 設定
 *
 * パフォーマンス最適化:
 * - 画像最適化（remotePatterns）
 * - 静的ページ生成の最適化
 *
 * セキュリティ (Issue #109):
 * - グローバルセキュリティヘッダー (CSP, X-Frame-Options, 等)
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

/**
 * Content-Security-Policy を組み立てる。
 *
 * 方針 (Issue #109):
 * - Next.js App Router はインラインスクリプトを注入するため、script-src は nonce ベースか
 *   `'unsafe-inline'` フォールバックが必要。Phase 1 現時点では nonce middleware を
 *   導入していないので `'self'` + 本番で `'strict-dynamic'` を入れずに
 *   外部依存なしの最小許可としている。
 * - Next.js Dev 環境は HMR のために `'unsafe-eval'` / `'unsafe-inline'` が必要。
 * - img-src は Supabase Storage / Unsplash / data URL を明示的に許可 (最小化)。
 * - connect-src はクライアントから直叩きする外部 API が無いので `'self'` 基本。
 *   (Supabase はサーバー側 infrastructure 層からのみ `@supabase/supabase-js` を呼び、
 *    ブラウザ側では `createBrowserClient` 等を一切使用していないことを確認済み。
 *    もし将来的にブラウザから Supabase SDK を直接叩くようになったら、
 *    `https://*.supabase.co` と `wss://*.supabase.co` を connect-src に追加すること)
 * - frame-ancestors は `X-Frame-Options: DENY` と整合するように `'none'`。
 */
function buildContentSecurityPolicy(): string {
  // 共通ディレクティブ
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    // img-src は必要なホストだけ明示的に許可する (`https:` 全面許可はやめる)。
    // - self: 自ドメインのアセット
    // - data: / blob: Next.js Image の placeholder / プレビュー
    // - *.supabase.co: アップロード画像の公開 URL
    // - images.unsplash.com: モック / サンプル画像
    "img-src": ["'self'", "data:", "blob:", "https://*.supabase.co", "https://images.unsplash.com"],
    "font-src": ["'self'", "data:"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "script-src": ["'self'"],
    // クライアントから直接叩く外部 API は現状なし (Supabase SDK はサーバー側のみ)。
    // NextAuth / API Routes は同一オリジン。
    "connect-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };

  if (isDevelopment) {
    // 開発環境: Next.js dev server の HMR / React Refresh が `eval` / inline を使う。
    directives["script-src"].push("'unsafe-eval'", "'unsafe-inline'");
    // ローカル Supabase (http://127.0.0.1:54321) への接続を許可 (Storage URL 等)。
    directives["connect-src"].push(
      "http://127.0.0.1:54321",
      "http://localhost:54321",
      // Next.js dev server の HMR (websocket)
      "ws://localhost:*",
      "ws://127.0.0.1:*"
    );
    // ローカル Supabase Storage の画像もあり得るので localhost/127.0.0.1 を許可。
    directives["img-src"].push("http://127.0.0.1:54321", "http://localhost:54321");
  } else {
    // 本番環境: Next.js の App Router ランタイムがインラインスクリプトを出力するため、
    // nonce middleware 導入までの暫定として `'unsafe-inline'` を維持する。
    // TODO(Issue #109 follow-up): nonce ベースへ移行して `'unsafe-inline'` を外す。
    directives["script-src"].push("'unsafe-inline'");
  }

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

/**
 * すべてのレスポンスに適用するセキュリティヘッダー群。
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // 不要な Web Platform Feature を明示的に無効化する。
    // 必要になった機能だけ `self` などに変更する想定。
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "picture-in-picture=()",
      // 将来的に Passkey / WebAuthn を使う可能性を残して self のみ許可する。
      "publickey-credentials-get=(self)",
      "screen-wake-lock=()",
      "sync-xhr=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
];

const nextConfig: NextConfig = {
  // Turbopack / Webpack のワークスペース root を明示する（無関係な親 package.json を避ける）。
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
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

  // セキュリティヘッダー (Issue #109)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  // 実験的な機能（将来的に有効化）
  experimental: {
    // Partial Prerendering（将来的に有効化）
    // ppr: true,
  },
};

export default nextConfig;
