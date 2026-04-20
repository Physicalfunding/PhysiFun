/**
 * Next.js `images.remotePatterns` と環境変数由来の Supabase ホスト解決の共通実装。
 *
 * apps/web と apps/admin の `next.config.ts` で重複していたロジックをこちらに
 * 集約する。Next.js の `RemotePattern` 型に直接依存すると ui-shared パッケージから
 * next を参照する必要が出るため、この共通モジュールでは「Next.js `RemotePattern`
 * と互換の plain object」を返すユーティリティとして定義し、呼び出し側で
 * `NonNullable<NextConfig["images"]>["remotePatterns"]` にそのまま代入できる
 * 構造にしておく。
 *
 * Issue #120 / PR #155 レビュー対応
 */

/**
 * Next.js の `RemotePattern` と同形の plain object。
 * 呼び出し側で `NextConfig["images"]["remotePatterns"]` として利用可能。
 */
export interface ImageRemotePattern {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname?: string;
}

/**
 * `NEXT_PUBLIC_SUPABASE_URL` からホスト名を抽出する。
 * 例: `https://abcxyz.supabase.co` → `abcxyz.supabase.co`
 * パース失敗・未設定時は null。
 */
export function resolveEnvSupabaseHost(env: string | undefined): string | null {
  if (!env) return null;
  try {
    return new URL(env).hostname;
  } catch {
    return null;
  }
}

/**
 * `<label>.supabase.co` の 1 階層サブドメインかどうか。
 * `abc.supabase.co` → true、`a.b.supabase.co` → false、`supabase.co` → false。
 */
export function isSingleLabelSupabaseHost(host: string): boolean {
  const suffix = ".supabase.co";
  if (!host.endsWith(suffix)) return false;
  const label = host.slice(0, -suffix.length);
  return label.length > 0 && !label.includes(".");
}

/**
 * apps/web・apps/admin 共通の画像 `remotePatterns` を組み立てる。
 *
 * @param options.env `process.env.NEXT_PUBLIC_SUPABASE_URL` を渡す
 * @param options.isDevelopment `process.env.NODE_ENV === "development"`
 * @returns Next.js `images.remotePatterns` にそのまま代入できる配列
 */
export function buildImageRemotePatterns(options: {
  env: string | undefined;
  isDevelopment: boolean;
}): ImageRemotePattern[] {
  const { env, isDevelopment } = options;
  const envSupabaseHost = resolveEnvSupabaseHost(env);

  const patterns: ImageRemotePattern[] = [
    // Supabase Storage 本番（ワイルドカード）
    {
      protocol: "https",
      hostname: "*.supabase.co",
      pathname: "/storage/v1/object/public/**",
    },
    // Unsplash（モック画像用） — pathname を `/photo-**` に限定
    {
      protocol: "https",
      hostname: "images.unsplash.com",
      pathname: "/photo-**",
    },
  ];

  // 環境変数から Supabase ホストを読み、`*.supabase.co` の 1 階層サブドメインで
  // 網羅できないケース（独自ドメイン or 多階層サブドメイン）のみ追加。
  if (envSupabaseHost && !isSingleLabelSupabaseHost(envSupabaseHost)) {
    patterns.push({
      protocol: "https",
      hostname: envSupabaseHost,
      pathname: "/storage/v1/object/public/**",
    });
  }

  // 開発環境のみローカル Supabase Storage を許可
  if (isDevelopment) {
    patterns.push(
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

  return patterns;
}
