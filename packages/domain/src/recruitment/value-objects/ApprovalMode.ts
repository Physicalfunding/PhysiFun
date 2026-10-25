/**
 * ApprovalMode
 *
 * 募集スケジュールの承認モード。リーダーが日程ごとに選ぶ。
 *
 * - `AUTO`   : サポーターが申し込んだ時点で参加が確定する
 * - `MANUAL` : リーダーが承認した時点で参加が確定する
 */
export const ApprovalMode = {
  AUTO: "AUTO",
  MANUAL: "MANUAL",
} as const;

export type ApprovalMode = (typeof ApprovalMode)[keyof typeof ApprovalMode];

/**
 * `ApprovalMode` の値配列（Zod `z.enum(...)` 用）
 */
export const APPROVAL_MODE_VALUES = Object.values(ApprovalMode) as [
  ApprovalMode,
  ...ApprovalMode[],
];

/**
 * 任意の値が `ApprovalMode` の値かどうかを判定する型ガード。
 *
 * 永続化層から復元するときに、DB の文字列を `ApprovalMode` に絞り込むのに使う。
 */
export function isApprovalMode(value: unknown): value is ApprovalMode {
  return typeof value === "string" && (Object.values(ApprovalMode) as string[]).includes(value);
}
