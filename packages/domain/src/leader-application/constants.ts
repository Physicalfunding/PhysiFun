/**
 * LeaderApplication ドメイン定数
 *
 * 応募フォーム拡張（Issue #192 / PR3）で追加されたフィールドの上限値・enum 値を集約する。
 * 文字数の単一情報源 (Single Source of Truth) として、Zod スキーマやアダプターから参照する。
 */

/**
 * リーダー応募の募集タイプ
 *
 * - `TIME`: 時間（やる気）での支援。活動内容・開催場所・実施期間・募集人数等が必須となる。
 * - `SKILL_ITEM`: スキル・モノでの支援。募集したい内容・期限等が必須となる。
 *
 * NOTE: 既存 `enum RecruitmentType { ACTIVITY }`（`SupportRecruitment` 用）と
 * 名前空間が衝突するため、Issue #192「名前空間衝突解決」案 2 を採用し
 * `LeaderApplicationRecruitmentType` という名称で衝突を回避する。
 */
export const LeaderApplicationRecruitmentType = {
  TIME: "TIME",
  SKILL_ITEM: "SKILL_ITEM",
} as const;

export type LeaderApplicationRecruitmentType =
  (typeof LeaderApplicationRecruitmentType)[keyof typeof LeaderApplicationRecruitmentType];

/**
 * `LeaderApplicationRecruitmentType` の妥当な値かどうかを判定する型ガード
 */
export function isLeaderApplicationRecruitmentType(
  value: string
): value is LeaderApplicationRecruitmentType {
  return value === "TIME" || value === "SKILL_ITEM";
}

/**
 * 応募フォーム文字列フィールドの最大文字数（Issue #192 仮値）
 *
 * 既存の `PROJECT_DRAFT_LIMITS` (projectTitle / projectSummary / projectStory / activityContent)
 * とは別に、PR3 で新規追加されたフィールドの仮値をここに集約する。
 * 仕様書で明示されているのは `experienceOffered` (150) と `timeReturn` (200)。
 * その他の自由記述フィールドは過剰制限を避けつつもサーバー側で最低限の長さ上限を持つよう
 * 200 文字を仮値として割り当てる（後続の仕様確定で見直し）。
 */
export const LEADER_APPLICATION_LIMITS = {
  experienceOffered: 150,
  timeReturn: 200,
  skillItemReturn: 200,
  eventLocation: 200,
  eventPeriod: 200,
  skillItemNeeds: 200,
  skillItemDeadline: 200,
} as const;
