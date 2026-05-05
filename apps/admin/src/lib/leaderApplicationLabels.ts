import { LeaderApplicationRecruitmentType } from "@physifun/domain";

/**
 * 募集タイプ (LeaderApplicationRecruitmentType) の日本語ラベル。
 *
 * Issue #192 PR3 で追加された `recruitmentTypes` フィールドを Admin 応募詳細で
 * 表示する際に利用する。仕様書の表記に合わせて以下のラベルを採用する。
 *
 * - TIME       : 「時間（やる気）での支援」
 * - SKILL_ITEM : 「スキル・モノでの支援」
 */
export const RECRUITMENT_TYPE_LABELS: Record<LeaderApplicationRecruitmentType, string> = {
  [LeaderApplicationRecruitmentType.TIME]: "時間（やる気）での支援",
  [LeaderApplicationRecruitmentType.SKILL_ITEM]: "スキル・モノでの支援",
};

/**
 * 募集タイプコードからラベルへ変換する。未知の値はそのまま返す（防御的フォールバック）。
 */
export function getRecruitmentTypeLabel(type: LeaderApplicationRecruitmentType): string {
  return RECRUITMENT_TYPE_LABELS[type] ?? type;
}
