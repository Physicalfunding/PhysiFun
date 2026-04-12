/**
 * LeaderApplication 集約のドメインエラー。
 *
 * 状態遷移系のエラーを表す。値オブジェクトのバリデーションエラーは
 * 各 VO 自身のエラー型で返す。
 */
export type LeaderApplicationStateError =
  | {
      readonly type: "CANNOT_APPROVE_NON_PENDING";
      readonly currentStatus: "APPROVED" | "REJECTED";
    }
  | {
      readonly type: "CANNOT_REJECT_NON_PENDING";
      readonly currentStatus: "APPROVED" | "REJECTED";
    }
  | { readonly type: "REVIEWER_NOTE_REQUIRED" }
  | {
      readonly type: "REVIEWER_NOTE_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    };
