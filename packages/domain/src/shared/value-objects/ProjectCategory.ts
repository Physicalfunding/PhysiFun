/**
 * ProjectCategory
 *
 * プロジェクトのカテゴリ。Phase 1 仮決定の 7 値セット。
 * 次回ミーティングで最終値域を決定する（`プロジェクト.md` 参照）。
 *
 * カテゴリマスターは `CATEGORY_MASTER` に集約し、UI 側の選択肢も
 * この配列から生成する想定（ラベルを編集しやすくするため）。
 *
 * 注: Phase 1 では #57 (LeaderApplication ドメイン) の `ProjectDraft` VO から
 * 参照される。将来 Project ドメイン (#71) 実装時に共有配置を再検討する。
 */
export const CATEGORY_MASTER = [
  { value: "KOMINKA", label: "古民家再生" },
  { value: "RICE_FARMING", label: "米作り" },
  { value: "FARMING", label: "その他農業" },
  { value: "DIY", label: "DIY・ものづくり" },
  { value: "EVENT", label: "地域イベント" },
  { value: "COMMUNITY", label: "コミュニティ運営" },
  { value: "OTHER", label: "その他" },
] as const;

export type ProjectCategory = (typeof CATEGORY_MASTER)[number]["value"];

const CATEGORY_VALUES = new Set<string>(CATEGORY_MASTER.map((c) => c.value));

export function isProjectCategory(value: string): value is ProjectCategory {
  return CATEGORY_VALUES.has(value);
}
