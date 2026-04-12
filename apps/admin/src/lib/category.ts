import { CATEGORY_MASTER } from "@physifun/domain";

const categoryMap = new Map<string, string>(CATEGORY_MASTER.map((c) => [c.value, c.label]));

/**
 * カテゴリコードからラベルに変換する
 */
export function getCategoryLabel(code: string): string {
  return categoryMap.get(code) ?? code;
}
