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
 * **SSRF 注意**:
 * 本関数はスキームのみを検証する。`coverImageUrl` 等の画像 URL については
 * `isAllowedImageUrl` (Issue #120) を使い、Supabase Storage ドメインの
 * allowlist + 内部 IP / メタデータエンドポイントの遮断を行うこと。
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
