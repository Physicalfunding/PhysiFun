/**
 * ProjectCategory
 *
 * プロジェクトのカテゴリ。初版リリース向けに確定した 4 値セット。
 *
 * カテゴリマスターは `CATEGORY_MASTER` に集約し、UI 側の選択肢も
 * この配列から生成する想定（ラベルを編集しやすくするため）。
 *
 * 注: DB には value を文字列で保持する（enum ではない）。値を変更・削除する
 * 場合は既存レコードの category 値との整合に注意する。
 */
export const CATEGORY_MASTER = [
  { value: "MANUFACTURING", label: "ものづくり・製品開発" },
  { value: "FOOD", label: "飲食・古民家" },
  { value: "NATURE", label: "農作業・キャンプ場（自然）" },
  { value: "EVENT", label: "イベント" },
] as const;

export type ProjectCategory = (typeof CATEGORY_MASTER)[number]["value"];

const CATEGORY_VALUES = new Set<string>(CATEGORY_MASTER.map((c) => c.value));

export function isProjectCategory(value: string): value is ProjectCategory {
  return CATEGORY_VALUES.has(value);
}
