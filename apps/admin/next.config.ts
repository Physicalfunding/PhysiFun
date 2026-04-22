import type { NextConfig } from "next";
// `@physifun/ui-shared` の index 経由だと SafeSnsLink.tsx (JSX) を巻き込むため、
// `next.config.ts` ローダ (Node, JSX 非対応) がビルドに失敗する。
// JSX を含まない純粋な設定モジュールのみを subpath export から読み込む。
import { buildImageRemotePatterns } from "@physifun/ui-shared/config/image-remote-patterns";

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
 *
 * Issue #147 (H-2):
 * - 運営アプリ向けのセキュリティヘッダー (CSP / X-Frame-Options / 等) を
 *   グローバルに付与する。apps/web の `securityHeaders` を下敷きにしつつ、
 *   admin 側は外部接続がほぼ無いので更に strict 化:
 *     - `img-src` は `data:` のみ (Supabase / Unsplash は不要。必要になったら追加)
 *     - `connect-src` は `'self'` のみ
 *     - `frame-ancestors` は `'none'` (CSRF / クリックジャッキング対策の二重化)
 *     - `Permissions-Policy` でカメラ / マイク / 位置情報を無効化
 */
const isDevelopment = process.env.NODE_ENV === "development";

const remotePatterns = buildImageRemotePatterns({
  env: process.env.NEXT_PUBLIC_SUPABASE_URL,
  isDevelopment,
});

/**
 * 運営管理アプリ向け Content-Security-Policy を組み立てる (#147 H-2)。
 *
 * 方針:
 * - 運営アプリはブラウザから外部 API を叩かない (Supabase SDK は infrastructure
 *   経由で必ずサーバーサイドから呼ぶ) ため、`connect-src` は `'self'` に絞る。
 * - 審査画面では Supabase Storage のカバー画像を next/image 経由で表示するため
 *   `img-src` に `https://*.supabase.co` を許可 (dev では localhost も追加)。
 * - Next.js App Router が出すインラインスクリプトのため `'unsafe-inline'` は
 *   暫定的に維持。nonce middleware 導入で今後外す予定 (web 側と同じ TODO)。
 * - `frame-ancestors 'none'` + `X-Frame-Options: DENY` の二重化で埋め込み禁止。
 */
function buildContentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    // Supabase Storage の画像を next/image で表示する。data: は Next.js の
    // placeholder 等。外部 CDN / Unsplash は運営 UI では使わないので許可しない。
    "img-src": ["'self'", "data:", "blob:", "https://*.supabase.co"],
    "font-src": ["'self'", "data:"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "script-src": ["'self'"],
    "connect-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };

  if (isDevelopment) {
    // Next.js dev server の HMR / React Refresh が eval / inline を使う。
    directives["script-src"].push("'unsafe-eval'", "'unsafe-inline'");
    directives["connect-src"].push(
      "http://127.0.0.1:54321",
      "http://localhost:54321",
      // Next.js dev server の HMR (websocket)
      "ws://localhost:*",
      "ws://127.0.0.1:*"
    );
    directives["img-src"].push("http://127.0.0.1:54321", "http://localhost:54321");
  } else {
    // 本番: App Router の inline script 用 (nonce 化は follow-up)。
    directives["script-src"].push("'unsafe-inline'");
  }

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

/**
 * 全レスポンスに付与するセキュリティヘッダー群 (#147 H-2)。
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
    // 運営アプリで使う Web Platform Feature は無い想定なので全て無効化。
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "picture-in-picture=()",
      "publickey-credentials-get=()",
      "screen-wake-lock=()",
      "sync-xhr=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
];

const nextConfig: NextConfig = {
  images: {
    // SSRF に関する注意:
    // dev では next/image の最適化が無効化されるため `remotePatterns` の
    // サーバーサイド fetch ガードは効かない。`isAllowedImageUrl` がクライアント
    // 側の唯一の SSRF 防御層となる。
    unoptimized: isDevelopment,
    remotePatterns,
  },

  // セキュリティヘッダー (#147 H-2)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
