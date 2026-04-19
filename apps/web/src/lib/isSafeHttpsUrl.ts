/**
 * URL が https スキームのみ許可する検証。
 *
 * Defense-in-depth: ドメイン層 (`SnsLinks`) のスキーム検証に加え、
 * 表示層でも `javascript:` / `data:` / `http:` 等を遮断する。
 *
 * `http:` は Mixed Content 回避のため拒否する（PR #142 レビュー指摘対応）。
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
