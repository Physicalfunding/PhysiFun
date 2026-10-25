/**
 * RecruitmentType
 *
 * サポート募集の種類。募集の作成時に決まり、あとから変わらない。
 *
 * - `ACTIVITY` : 活動参加募集。リーダーが示した時間帯に、サポーターが時間を提供して参加する
 *
 * 初回リリースは `ACTIVITY` のみ（スキル・モノ募集は #291 で検討する）。
 *
 * NOTE: リーダー応募の `LeaderApplicationRecruitmentType`（TIME / SKILL_ITEM）とは別の概念
 * （応募時の希望と、実際に出す募集の種類）。`RECRUITMENT_TYPE_VALUES` は leader-application が
 * export 済みなので、値配列は `SUPPORT_RECRUITMENT_TYPE_VALUES` とする。
 */
export const RecruitmentType = {
  ACTIVITY: "ACTIVITY",
} as const;

export type RecruitmentType = (typeof RecruitmentType)[keyof typeof RecruitmentType];

/**
 * `RecruitmentType` の値配列（Zod `z.enum(...)` 用）
 */
export const SUPPORT_RECRUITMENT_TYPE_VALUES = Object.values(RecruitmentType) as [
  RecruitmentType,
  ...RecruitmentType[],
];

/**
 * 任意の値が `RecruitmentType` の値かどうかを判定する型ガード。
 *
 * 永続化層から復元するときに、DB の文字列を `RecruitmentType` に絞り込むのに使う。
 */
export function isRecruitmentType(value: unknown): value is RecruitmentType {
  return typeof value === "string" && (Object.values(RecruitmentType) as string[]).includes(value);
}
