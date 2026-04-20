/**
 * 画像 URL の allowlist 検証（SSRF 対策）。
 *
 * `isSafeHttpsUrl` がスキームのみを検証していたのに対し、こちらは
 * ホスト名の allowlist と内部 IP アドレスの遮断を追加し、`coverImageUrl`
 * などサーバー側で画像取得が発生しうる経路で SSRF ベクタを閉じる。
 *
 * 許可ホスト：
 * - `<label>.supabase.co`（Supabase Storage 本番、1 階層サブドメインのみ）
 * - `images.unsplash.com`（モック画像。UI で利用中）
 * - `NEXT_PUBLIC_SUPABASE_URL` 環境変数のホスト名（独自ドメイン時は完全一致のみ）
 * - 開発環境 (`NODE_ENV === "development"`) のみ `127.0.0.1:54321` / `localhost:54321`
 *
 * 拒否対象：
 * - `https:` 以外のスキーム（開発の `http://127.0.0.1:54321` を除く）
 * - production 相当環境での非標準ポート（https の 443 以外、または空でない port）
 * - credentials 埋込 URL（`https://user:pass@host/...`）
 * - `169.254.169.254`（AWS/GCP インスタンスメタデータ）
 * - `127.0.0.0/8`（ループバック。ただし開発 Supabase ローカルは例外）
 * - RFC1918 プライベート IP：`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
 * - `0.0.0.0` / IPv6 unspecified `::`
 * - IPv6 ループバック `[::1]`
 * - IPv4-mapped IPv6 `::ffff:0:0/96`（内包する IPv4 を再帰的に評価）
 * - IPv6 ULA `fc00::/7`、link-local `fe80::/10`
 * - 多階層サブドメイン（`a.b.supabase.co` 等）
 * - 独自 Supabase ドメイン時の多階層サブドメイン（env のホスト完全一致のみ許可）
 * - URL パースに失敗するもの
 *
 * ここで許可される URL のみ `next/image` の `remotePatterns` に合致する想定。
 * 2 重防御として `next.config.ts` 側でも remotePatterns を絞り込む。
 *
 * 注意：本モジュールは Client Component からも import される。そのため、
 * `process.env.NODE_ENV` の評価は Next.js のバンドル時に定数展開され、
 * クライアント側ではビルド時の値が固定される点に留意する（SSR / CSR で
 * 挙動差を出したい場合は別途サーバー専用モジュールに分離する必要がある）。
 *
 * Issue #120
 */

/** Supabase Storage の本番ドメインサフィックス */
const SUPABASE_DOMAIN_SUFFIX = ".supabase.co";

/** モック/Unsplash 画像用の固定許可ホスト */
const UNSPLASH_HOST = "images.unsplash.com";

/** 開発環境でのみ許可するローカル Supabase ホスト */
const LOCAL_SUPABASE_HOSTS: ReadonlyArray<{ host: string; port: string }> = [
  { host: "127.0.0.1", port: "54321" },
  { host: "localhost", port: "54321" },
];

/**
 * 与えられた IPv4 文字列が SSRF リスクのあるアドレスか判定する。
 * ドット区切り 4 オクテットを前提とし、それ以外は false。
 */
function isPrivateOrMetadataIPv4(hostname: string): boolean {
  // IPv4 ドット区切りでなければ判定対象外
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;

  const octets = match.slice(1, 5).map((v) => Number(v));
  // 防御的プログラミング：正規表現で 1-3 桁を許容しているため 300 等が通る。
  // `new URL` パス側の検証と重複するが、ここで再度弾いておく。
  if (octets.some((v) => Number.isNaN(v) || v < 0 || v > 255)) {
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
 * 与えられたホスト名が SSRF リスクのある内部/プライベート IP かを判定する。
 *
 * IPv4:
 * - 0.0.0.0
 * - 127.0.0.0/8（ループバック）
 * - 10.0.0.0/8
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 * - 169.254.0.0/16
 *
 * IPv6（`new URL` は `[::1]` を `::1` にして hostname に返す）:
 * - `::1`（ループバック）
 * - `::`（unspecified）
 * - `::ffff:0:0/96`（IPv4-mapped。内包 IPv4 を再帰評価）
 * - `fc00::/7`（ULA）
 * - `fe80::/10`（link-local）
 */
function isPrivateOrMetadataHost(hostname: string): boolean {
  // IPv6 は `new URL` 経由では角括弧が外れた文字列で来るが、念のため両方ケア
  const stripped =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;

  // IPv6 っぽいかは単純に `:` の有無で判定（IPv4 には `:` が含まれない）
  if (stripped.includes(":")) {
    const lower = stripped.toLowerCase();

    // 全部ゼロ（::）または ::1
    if (
      lower === "::" ||
      lower === "::1" ||
      lower === "0:0:0:0:0:0:0:0" ||
      lower === "0:0:0:0:0:0:0:1"
    ) {
      return true;
    }

    // IPv4-mapped IPv6 (::ffff:a.b.c.d 形式)
    // 例: ::ffff:127.0.0.1, ::ffff:169.254.169.254
    // 内包 IPv4 をプライベート判定するが、IPv4-mapped 自体が内部→外部境界を
    // 曖昧にする攻撃面なので、allowlist 対象外ホストとして常に拒否する。
    const mappedDotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(stripped);
    if (mappedDotted) {
      // 内包 IPv4 の形式チェックを兼ねて再帰評価（副作用的に不正値も弾く）
      isPrivateOrMetadataIPv4(mappedDotted[1] as string);
      return true;
    }
    // ::ffff:H:L 形式（16 進 2 グループで IPv4 を表現。例: ::ffff:7f00:1）
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/i.test(stripped)) {
      return true;
    }

    // 最初の 16bit グループを取り出して範囲判定（省略時のゼロもケア）
    const firstGroup = lower.startsWith("::") ? "0" : lower.split(":")[0] || "0";
    const firstHex = parseInt(firstGroup, 16);
    if (!Number.isNaN(firstHex)) {
      // fe80::/10 (link-local): 先頭 10bit が 1111111010 → 0xfe80 〜 0xfebf
      if (firstHex >= 0xfe80 && firstHex <= 0xfebf) {
        return true;
      }
      // fc00::/7 (ULA): 先頭 7bit が 1111110 → 0xfc00 〜 0xfdff
      if (firstHex >= 0xfc00 && firstHex <= 0xfdff) {
        return true;
      }
    }

    // それ以外の IPv6 アドレスは allowlist でホスト名一致が来ないためここで判定不要。
    // 念のため、解析できない形でも安全側に倒す必要はないので false（allowlist で落ちる）。
    return false;
  }

  return isPrivateOrMetadataIPv4(hostname);
}

/**
 * ホスト名が許可リスト（Supabase Storage / Unsplash / 環境変数で指定された Supabase）
 * に合致するかを判定する。
 *
 * Supabase ホストの扱い:
 * - `*.supabase.co` は「1 階層サブドメインのみ」を許可（`abc.supabase.co` は可、
 *   `a.b.supabase.co` は不可）。Supabase の実運用は単階層のため、安全寄りに倒す。
 * - env の独自ドメイン（`NEXT_PUBLIC_SUPABASE_URL`）は env のホストと完全一致のみ許可。
 */
function isAllowedHost(hostname: string, envSupabaseHost: string | null): boolean {
  if (hostname === UNSPLASH_HOST) return true;

  // `<label>.supabase.co`。サブドメインが空 or ドット含み（= 多階層）は拒否。
  if (
    hostname.endsWith(SUPABASE_DOMAIN_SUFFIX) &&
    hostname.length > SUPABASE_DOMAIN_SUFFIX.length
  ) {
    const subdomain = hostname.slice(0, -SUPABASE_DOMAIN_SUFFIX.length);
    // サブドメインが 1 文字以上、かつ "." を含まない（= 1 階層のみ）
    if (subdomain.length > 0 && !subdomain.includes(".")) {
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
 *
 * env 値をキャッシュキーに含めることで、テストで env を切り替えたときでも
 * 正しく再計算されるようにしている（プロセス生存中は本番でほぼヒット）。
 */
let envHostCache: { env: string | undefined; host: string | null } | null = null;

function computeEnvSupabaseHost(env: string | undefined): string | null {
  if (!env) return null;
  try {
    return new URL(env).hostname;
  } catch {
    return null;
  }
}

function resolveEnvSupabaseHost(): string | null {
  const env = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (envHostCache && envHostCache.env === env) {
    return envHostCache.host;
  }
  const host = computeEnvSupabaseHost(env);
  envHostCache = { env, host };
  return host;
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

  // credentials 埋込 URL は一律拒否（同名攻撃・履歴漏洩対策）
  if (parsed.username !== "" || parsed.password !== "") {
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

  // https の標準ポートのみ許可（空文字 = デフォルト 443、または明示 "443"）。
  // `:8443` など非標準ポート経由の SSRF / 内部サービスへの間接アクセスを遮断。
  if (parsed.port !== "" && parsed.port !== "443") {
    return false;
  }

  // SSRF: 内部 IP / メタデータエンドポイントは拒否
  if (isPrivateOrMetadataHost(hostname)) {
    return false;
  }

  const envSupabaseHost = resolveEnvSupabaseHost();
  return isAllowedHost(hostname, envSupabaseHost);
}
