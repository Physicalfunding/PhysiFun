/**
 * URL が http(s) スキームのみ許可する検証。
 *
 * Defense-in-depth: ドメイン層 (`SnsLinks`) のスキーム検証に加え、
 * 表示層でも `javascript:` / `data:` 等を遮断する。
 *
 * `new URL()` によるパースで percent-encoding やホワイトスペースの
 * エッジケースも正しく処理する。
 */
export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
