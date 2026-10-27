import {
  type Result,
  err,
  ok,
  AccountId,
  RecruitmentScheduleId,
  type RecruitmentScheduleError,
  SupportRecruitmentId,
} from "@physifun/domain";
import { findOwnedRecruitment } from "./findOwnedRecruitment";
import type { RemoveSchedulePort } from "./ports/RemoveSchedulePort";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface RemoveScheduleOutput {
  readonly scheduleId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type RemoveScheduleError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_RECRUITMENT_ID" }
  | { readonly type: "INVALID_SCHEDULE_ID" }
  | { readonly type: "RECRUITMENT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" }
  | RecruitmentScheduleError;

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface RemoveScheduleInput {
  readonly accountId: string;
  readonly recruitmentId: string;
  readonly scheduleId: string;
}

// ==================== ユースケース ====================

/**
 * サポート募集の日程を削除するユースケース（過去の日程も削除できる）
 *
 * 処理フロー:
 * 1. AccountId / SupportRecruitmentId / RecruitmentScheduleId VO 生成（入力バリデーション）
 * 2. 募集の存在チェック + オーナー権限チェック
 * 3. recruitment.removeSchedule()（日程の存在チェック）
 * 4. 永続化（ルートが返した日程を渡す）
 */
export class RemoveScheduleUseCase {
  constructor(private readonly port: RemoveSchedulePort) {}

  async execute(
    input: RemoveScheduleInput
  ): Promise<Result<RemoveScheduleOutput, RemoveScheduleError>> {
    // 1. VO 生成（入力バリデーション）
    const accountIdResult = AccountId.from(input.accountId);
    if (!accountIdResult.ok) {
      return err({ type: "INVALID_ACCOUNT_ID" });
    }

    const recruitmentIdResult = SupportRecruitmentId.from(input.recruitmentId);
    if (!recruitmentIdResult.ok) {
      return err({ type: "INVALID_RECRUITMENT_ID" });
    }

    const scheduleIdResult = RecruitmentScheduleId.from(input.scheduleId);
    if (!scheduleIdResult.ok) {
      return err({ type: "INVALID_SCHEDULE_ID" });
    }

    // 2. 募集の存在チェック + オーナー権限チェック
    const ownedResult = await findOwnedRecruitment(
      this.port,
      recruitmentIdResult.value,
      accountIdResult.value
    );
    if (!ownedResult.ok) {
      return err(ownedResult.error);
    }

    // 3. ドメインロジック（日程の存在チェック）
    const removeResult = ownedResult.value.removeSchedule(scheduleIdResult.value);
    if (!removeResult.ok) {
      return err(removeResult.error);
    }

    // 4. 永続化
    const removed = removeResult.value;
    await this.port.removeSchedule(removed);

    return ok({ scheduleId: removed.id.toString() });
  }
}
