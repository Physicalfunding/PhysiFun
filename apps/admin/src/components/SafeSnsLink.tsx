/**
 * URL が http(s) スキームのみ許可する簡易ホワイトリスト検証。
 *
 * Defense-in-depth として、ドメイン層 (`SnsLinks`) のスキーム検証に加えて
 * 表示層でも同等の検証を行う。`javascript:` / `data:` / `vbscript:` / `file:`
 * などを遮断する。
 *
 * - SNS/Website リンク: XSS 対策として domain 層で一次防御済み (Issue #118)
 * - 大小文字は区別しない (`HTTPS://` も許可)
 *
 * **SSRF 注意 (Issue #120 で別途対応予定)**:
 * 本関数はスキームのみを検証する。`coverImageUrl` 等の画像 URL では、
 * `http://169.254.169.254/` (AWS インスタンスメタデータ) や RFC1918 内部 IP
 * を踏ませる SSRF ベクタが残るため、画像表示用途では Supabase Storage
 * ドメインのホスト allowlist + `next/image` 移行で別防御を入れる必要がある。
 */
export function isSafeHttpUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.startsWith("https://") || lower.startsWith("http://");
}

/**
 * SNS リンクの安全表示コンポーネント。
 *
 * `SnsLinks` ドメイン VO の URL スキーム検証を通過した値のみ DB に到達する前提だが、
 * データ不整合や将来のマイグレーション漏れに備えて表示層でも再チェックする。
 * 不正スキームの場合はリンクではなくプレーンテキストで警告表示する。
 */
export function SafeSnsLink({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  if (!isSafeHttpUrl(url)) {
    return (
      <p className="text-sm text-red-600">
        {label}: 表示できない URL 形式です ({url})
      </p>
    );
  }
  return (
    <p className="text-sm">
      {label}:{" "}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {url}
      </a>
    </p>
  );
}
