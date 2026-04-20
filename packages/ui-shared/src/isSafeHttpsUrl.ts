/**
 * URL が https スキームのみ許可する簡易ホワイトリスト検証。
 *
 * Defense-in-depth として、ドメイン層 (`SnsLinks`) のスキーム検証に加えて
 * 表示層でも同等の検証を行う。`javascript:` / `data:` / `vbscript:` / `file:`
 * / `http:` などを遮断する。
 *
 * - SNS/Website リンク: XSS 対策として domain 層で一次防御済み (Issue #118)
 * - `http:` は Mixed Content 回避のため拒否する (PR #142 レビュー指摘対応)
 * - 大小文字は区別しない (`HTTPS://` も許可)
 *
 * **SSRF 注意 (Issue #120 で別途対応予定)**:
 * 本関数はスキームのみを検証する。`coverImageUrl` 等の画像 URL では、
 * `http://169.254.169.254/` (AWS インスタンスメタデータ) や RFC1918 内部 IP
 * を踏ませる SSRF ベクタが残るため、画像表示用途では Supabase Storage
 * ドメインのホスト allowlist + `next/image` 移行で別防御を入れる必要がある。
 *
 * `new URL()` によるパースで percent-encoding やホワイトスペースの
 * エッジケースも正しく処理する。
 */
export function isSafeHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
