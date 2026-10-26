import {
  type Result,
  err,
  ok,
  AccountId,
  CapacityPerHour,
  type RecruitmentScheduleError,
  ScheduleDate,
  ScheduleDateConflictError,
  SupportRecruitmentId,
} from "@physifun/domain";
import { findOwnedRecruitment } from "./findOwnedRecruitment";
import type { AddSchedulePort } from "./ports/AddSchedulePort";
import { type ScheduleInputError, isPastInJst, toApprovalMode, toTimeRange } from "./scheduleInput";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface AddScheduleOutput {
  readonly scheduleId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type AddScheduleError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_RECRUITMENT_ID" }
  | { readonly type: "RECRUITMENT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" }
  | ScheduleInputError
  | RecruitmentScheduleError;

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface AddScheduleInput {
  readonly accountId: string;
  readonly recruitmentId: string;
  /** JST のカレンダー日（"YYYY-MM-DD"） */
  readonly date: string;
  /** JST の "HH:00" */
  readonly startTime: string;
  /** JST の "HH:00" */
  readonly endTime: string;
  readonly capacityPerHour: number;
  readonly approvalMode: string;
}

// ==================== ユースケース ====================

/**
 * サポート募集に日程を追加するユースケース
 *
 * - JST の今日より前の日付は追加できない（`SCHEDULE_DATE_IN_PAST`。今日は可）
 * - 同じ募集に同じ日付の日程があれば `DUPLICATE_SCHEDULE_DATE`。同時に追加されたときは、
 *   リポジトリが投げる `ScheduleDateConflictError` を同じエラーに変える
 *
 * 処理フロー:
 * 1. AccountId / SupportRecruitmentId VO 生成（入力バリデーション）
 * 2. 募集の存在チェック + オーナー権限チェック
 * 3. 日程の入力を値オブジェクトに変換 + 過去の日付チェック
 * 4. recruitment.addSchedule()（日付の重複チェック）
 * 5. 永続化（ルートが返した日程を渡す）
 */
export class AddScheduleUseCase {
  constructor(private readonly port: AddSchedulePort) {}

  async execute(input: AddScheduleInput): Promise<Result<AddScheduleOutput, AddScheduleError>> {
    // 1. AccountId / SupportRecruitmentId VO 生成（入力バリデーション）
    const accountIdResult = AccountId.from(input.accountId);
    if (!accountIdResult.ok) {
      return err({ type: "INVALID_ACCOUNT_ID" });
    }

    const recruitmentIdResult = SupportRecruitmentId.from(input.recruitmentId);
    if (!recruitmentIdResult.ok) {
      return err({ type: "INVALID_RECRUITMENT_ID" });
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
    const recruitment = ownedResult.value;

    // 3. 日程の入力を値オブジェクトに変換
    const dateResult = ScheduleDate.from(input.date);
    if (!dateResult.ok) {
      return err(dateResult.error);
    }
    if (isPastInJst(dateResult.value)) {
      return err({ type: "SCHEDULE_DATE_IN_PAST", date: input.date });
    }

    const timeRangeResult = toTimeRange(input.startTime, input.endTime);
    if (!timeRangeResult.ok) {
      return err(timeRangeResult.error);
    }

    const capacityResult = CapacityPerHour.from(input.capacityPerHour);
    if (!capacityResult.ok) {
      return err(capacityResult.error);
    }

    const approvalModeResult = toApprovalMode(input.approvalMode);
    if (!approvalModeResult.ok) {
      return err(approvalModeResult.error);
    }

    // 4. ドメインロジック（日付の重複チェック）
    const addResult = recruitment.addSchedule({
      date: dateResult.value,
      timeRange: timeRangeResult.value,
      capacityPerHour: capacityResult.value,
      approvalMode: approvalModeResult.value,
    });
    if (!addResult.ok) {
      return err(addResult.error);
    }

    // 5. 永続化（同時に同じ日付が追加されたときは DB の unique 制約が止める）
    const schedule = addResult.value;
    try {
      await this.port.addSchedule(schedule);
    } catch (e) {
      if (e instanceof ScheduleDateConflictError) {
        return err({ type: "DUPLICATE_SCHEDULE_DATE", date: e.date });
      }
      throw e;
    }

    return ok({ scheduleId: schedule.id.toString() });
  }
}
