import {
  type Result,
  err,
  ok,
  AccountId,
  type ApprovalMode,
  CapacityPerHour,
  RecruitmentScheduleId,
  type RecruitmentScheduleError,
  ScheduleDate,
  ScheduleDateConflictError,
  SupportRecruitmentId,
  type TimeRange,
} from "@physifun/domain";
import { findOwnedRecruitment } from "./findOwnedRecruitment";
import type { UpdateSchedulePort } from "./ports/UpdateSchedulePort";
import { type ScheduleInputError, isPastInJst, toApprovalMode, toTimeRange } from "./scheduleInput";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface UpdateScheduleOutput {
  readonly scheduleId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type UpdateScheduleError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_RECRUITMENT_ID" }
  | { readonly type: "INVALID_SCHEDULE_ID" }
  | { readonly type: "RECRUITMENT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" }
  | ScheduleInputError
  | RecruitmentScheduleError;

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO（指定した項目だけ変える）
 *
 * `startTime` / `endTime` は片方だけでもよい（もう片方は今の値を使う）。
 */
export interface UpdateScheduleInput {
  readonly accountId: string;
  readonly recruitmentId: string;
  readonly scheduleId: string;
  /** JST のカレンダー日（"YYYY-MM-DD"） */
  readonly date?: string;
  /** JST の "HH:00" */
  readonly startTime?: string;
  /** JST の "HH:00" */
  readonly endTime?: string;
  readonly capacityPerHour?: number;
  readonly approvalMode?: string;
}

// ==================== ユースケース ====================

/**
 * サポート募集の日程を変更するユースケース
 *
 * - 日付を JST の今日より前に変えることはできない（`SCHEDULE_DATE_IN_PAST`）。
 *   日付を変えない編集は、過去の日程でもできる（今と同じ日付が送られてきた場合を含む）
 * - 変更後の日付の日程がすでにあれば `DUPLICATE_SCHEDULE_DATE`。同時に変更されたときは、
 *   リポジトリが投げる `ScheduleDateConflictError` を同じエラーに変える
 *
 * 処理フロー:
 * 1. AccountId / SupportRecruitmentId / RecruitmentScheduleId VO 生成（入力バリデーション）
 * 2. 募集の存在チェック + オーナー権限チェック
 * 3. 日程の存在チェック
 * 4. 日程の入力を値オブジェクトに変換 + 過去の日付チェック
 * 5. recruitment.updateSchedule()（日付の重複チェック）
 * 6. 永続化（ルートが返した日程を渡す）
 */
export class UpdateScheduleUseCase {
  constructor(private readonly port: UpdateSchedulePort) {}

  async execute(
    input: UpdateScheduleInput
  ): Promise<Result<UpdateScheduleOutput, UpdateScheduleError>> {
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
    const scheduleId = scheduleIdResult.value;

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

    // 3. 日程の存在チェック（時間帯を片方だけ変えるとき、今の値が要る）
    const current = recruitment.schedules.find((s) => s.id.equals(scheduleId));
    if (!current) {
      return err({ type: "SCHEDULE_NOT_FOUND", scheduleId: input.scheduleId });
    }

    // 4. 日程の入力を値オブジェクトに変換（指定された項目だけ）

    // date
    let date: ScheduleDate | undefined;
    if (input.date !== undefined) {
      const dateResult = ScheduleDate.from(input.date);
      if (!dateResult.ok) {
        return err(dateResult.error);
      }
      if (!dateResult.value.equals(current.date) && isPastInJst(dateResult.value)) {
        return err({ type: "SCHEDULE_DATE_IN_PAST", date: input.date });
      }
      date = dateResult.value;
    }

    // timeRange
    let timeRange: TimeRange | undefined;
    if (input.startTime !== undefined || input.endTime !== undefined) {
      const timeRangeResult = toTimeRange(
        input.startTime ?? current.timeRange.start,
        input.endTime ?? current.timeRange.end
      );
      if (!timeRangeResult.ok) {
        return err(timeRangeResult.error);
      }
      timeRange = timeRangeResult.value;
    }

    // capacityPerHour
    let capacityPerHour: CapacityPerHour | undefined;
    if (input.capacityPerHour !== undefined) {
      const capacityResult = CapacityPerHour.from(input.capacityPerHour);
      if (!capacityResult.ok) {
        return err(capacityResult.error);
      }
      capacityPerHour = capacityResult.value;
    }

    // approvalMode
    let approvalMode: ApprovalMode | undefined;
    if (input.approvalMode !== undefined) {
      const approvalModeResult = toApprovalMode(input.approvalMode);
      if (!approvalModeResult.ok) {
        return err(approvalModeResult.error);
      }
      approvalMode = approvalModeResult.value;
    }

    // 5. ドメインロジック（日付の重複チェック）
    const updateResult = recruitment.updateSchedule(scheduleId, {
      date,
      timeRange,
      capacityPerHour,
      approvalMode,
    });
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    // 6. 永続化（同時に同じ日付へ変更されたときは DB の unique 制約が止める）
    const schedule = updateResult.value;
    try {
      await this.port.updateSchedule(schedule);
    } catch (e) {
      if (e instanceof ScheduleDateConflictError) {
        return err({ type: "DUPLICATE_SCHEDULE_DATE", date: e.date });
      }
      throw e;
    }

    return ok({ scheduleId: schedule.id.toString() });
  }
}
