/**
 * LeaderApplicationStatus
 *
 * リーダー応募の状態。
 *
 * - `PENDING`  : 申請直後、運営審査待ち
 * - `APPROVED` : 運営が承認した終状態
 * - `REJECTED` : 運営が却下した終状態
 *
 * 終状態からの再遷移はドメインレベルで禁止する（`LeaderApplication.approve()` / `reject()` がエラーを返す）。
 */
export const LeaderApplicationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type LeaderApplicationStatus =
  (typeof LeaderApplicationStatus)[keyof typeof LeaderApplicationStatus];
