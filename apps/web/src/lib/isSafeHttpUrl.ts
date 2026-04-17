/**
 * URL が http(s) スキームのみ許可する簡易ホワイトリスト検証。
 *
 * Defense-in-depth: ドメイン層 (`SnsLinks`) のスキーム検証に加え、
 * 表示層でも `javascript:` / `data:` 等を遮断する。
 */
export function isSafeHttpUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.startsWith("https://") || lower.startsWith("http://");
}
