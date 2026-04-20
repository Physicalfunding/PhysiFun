/**
 * 画像 URL の allowlist 検証（SSRF 対策）。
 *
 * `isSafeHttpsUrl` がスキームのみを検証していたのに対し、こちらは
 * ホスト名の allowlist と内部 IP アドレスの遮断を追加し、`coverImageUrl`
 * などサーバー側で画像取得が発生しうる経路で SSRF ベクタを閉じる。
 *
 * 許可ホスト：
 * - `*.supabase.co`（Supabase Storage 本番）
 * - `images.unsplash.com`（モック画像。UI で利用中）
 * - `NEXT_PUBLIC_SUPABASE_URL` 環境変数のホスト名（プロジェクト毎のプロダクション
 *   ホストを動的に許可。環境変数が設定されている場合のみ）
 * - 開発環境 (`NODE_ENV === "development"`) のみ `127.0.0.1:54321` / `localhost:54321`
 *
 * 拒否対象：
 * - `https:` 以外のスキーム（開発の `http://127.0.0.1:54321` を除く）
 * - `169.254.169.254`（AWS/GCP インスタンスメタデータ）
 * - `127.0.0.0/8`（ループバック。ただし開発 Supabase ローカルは例外）
 * - RFC1918 プライベート IP：`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
 * - `0.0.0.0` / IPv6 ループバック `[::1]`
 * - URL パースに失敗するもの
 *
 * ここで許可される URL のみ `next/image` の `remotePatterns` に合致する想定。
 * 2 重防御として `next.config.ts` 側でも remotePatterns を絞り込む。
 *
 * Issue #120
 */

/** Supabase Storage の本番ドメインワイルドカード */
const SUPABASE_DOMAIN_SUFFIX = ".supabase.co";

/** モック/Unsplash 画像用の固定許可ホスト */
const UNSPLASH_HOST = "images.unsplash.com";

/** 開発環境でのみ許可するローカル Supabase ホスト */
const LOCAL_SUPABASE_HOSTS: ReadonlyArray<{ host: string; port: string }> = [
  { host: "127.0.0.1", port: "54321" },
  { host: "localhost", port: "54321" },
];

/**
 * 与えられたホスト名が SSRF リスクのある内部/プライベート IP かを判定する。
 *
 * - 169.254.169.254（AWS/GCP メタデータ）
 * - 127.0.0.0/8（ループバック）
 * - 10.0.0.0/8
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 * - 0.0.0.0
 * - IPv6 ループバック `::1`
 */
function isPrivateOrMetadataHost(hostname: string): boolean {
  // IPv6 ループバック（`new URL` は `[::1]` を `::1` にして返す）
  if (hostname === "::1" || hostname === "[::1]") return true;

  // IPv4 ドット区切りでなければ判定対象外（DNS 名扱い）
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;

  const octets = match.slice(1, 5).map((v) => Number(v));
  if (octets.some((v) => Number.isNaN(v) || v < 0 || v > 255)) {
    // IPv4 形式に見えるが不正値 → 安全側で拒否
    return true;
  }

  const [a, b] = octets as [number, number, number, number];

  // 0.0.0.0
  if (a === 0) return true;
  // 127.0.0.0/8 (ループバック)
  if (a === 127) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16（link-local + メタデータ 169.254.169.254 を包括）
  if (a === 169 && b === 254) return true;

  return false;
}

/**
 * ホスト名が許可リスト（Supabase Storage / Unsplash / 環境変数で指定された Supabase）
 * に合致するかを判定する。
 */
function isAllowedHost(hostname: string, envSupabaseHost: string | null): boolean {
  if (hostname === UNSPLASH_HOST) return true;

  // `*.supabase.co`。ワイルドカード部分は空でないサブドメインを要求する
  // （`.supabase.co` 単体や完全一致は拒否）。
  if (
    hostname.endsWith(SUPABASE_DOMAIN_SUFFIX) &&
    hostname.length > SUPABASE_DOMAIN_SUFFIX.length
  ) {
    const subdomain = hostname.slice(0, -SUPABASE_DOMAIN_SUFFIX.length);
    // サブドメインに "." 以外の文字が 1 文字以上必要
    if (subdomain.length > 0 && !subdomain.startsWith(".")) {
      return true;
    }
  }

  if (envSupabaseHost && hostname === envSupabaseHost) {
    return true;
  }

  return false;
}

/**
 * `NEXT_PUBLIC_SUPABASE_URL` からホスト名を抽出する。パース失敗時は null。
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

/**
 * 画像 URL が allowlist に合致し、かつ SSRF リスクがないかを検証する。
 *
 * @param url 検証対象の URL 文字列
 * @returns 許可可能なら true、そうでなければ false
 */
export function isAllowedImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const isDevelopment = process.env.NODE_ENV === "development";
  const hostname = parsed.hostname;

  // 開発環境に限り、ローカル Supabase (`http://127.0.0.1:54321` など) を許可する。
  // 本番相当環境では SSRF 対策として拒否する。
  if (isDevelopment) {
    const localMatch = LOCAL_SUPABASE_HOSTS.find(
      ({ host, port }) =>
        hostname === host &&
        parsed.port === port &&
        (parsed.protocol === "http:" || parsed.protocol === "https:")
    );
    if (localMatch) {
      return true;
    }
  }

  // 本番許可は https のみ（Mixed Content 回避 + localhost 誤許可防止）
  if (parsed.protocol !== "https:") {
    return false;
  }

  // SSRF: 内部 IP / メタデータエンドポイントは拒否
  if (isPrivateOrMetadataHost(hostname)) {
    return false;
  }

  const envSupabaseHost = resolveEnvSupabaseHost();
  return isAllowedHost(hostname, envSupabaseHost);
}
