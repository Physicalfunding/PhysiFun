/**
 * HTML 特殊文字をエスケープする。
 *
 * ユーザー入力（reviewerNote, projectTitle 等）を HTML メールテンプレートに
 * 埋め込む際に XSS を防止する。
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
