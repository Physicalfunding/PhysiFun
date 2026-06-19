/**
 * ネイティブ PostgreSQL enum の配列を JS 文字列配列へ正規化する。
 *
 * node-postgres は **enum 型の配列を解析できず**、配列リテラル文字列のまま返す
 * （例: "{SUPPORTER,LEADER}" / "{}"）。enum 型の OID が既定の型パーサに登録されて
 * いないためで、text[] / int[] 等の組み込み配列型とは挙動が異なる。
 * 一方 INSERT 側は JS 配列を渡せば pg が配列リテラルへ直列化するため、**読み取り側のみ**
 * 本変換が必要になる（roles / recruitmentTypes など）。
 *
 * - 既に配列の場合（`::text[]` へキャストした場合や将来の型パーサ登録時）はそのまま返す。
 * - 本プロジェクトの enum ラベルは英大文字 + アンダースコアのみのため、要素のクォートや
 *   カンマ・エスケープは発生しないが、念のためダブルクォート囲みは外す。
 */
export function parsePgEnumArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    // 想定外フォーマットは防御的に単一要素として扱う。
    return trimmed.length > 0 ? [trimmed] : [];
  }
  const inner = trimmed.slice(1, -1);
  if (inner.length === 0) return [];
  return inner.split(",").map((el) => el.replace(/^"(.*)"$/, "$1"));
}
