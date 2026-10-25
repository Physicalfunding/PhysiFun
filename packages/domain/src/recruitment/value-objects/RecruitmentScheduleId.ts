import { randomUUID } from "node:crypto";
import { type Result, err, ok } from "../../shared/result";
import { isUuidV4 } from "../../shared/uuid";

/**
 * RecruitmentScheduleId 値オブジェクト
 *
 * 募集スケジュール（サポート募集の日程）を一意に識別する ID。UUID v4 形式。
 */
export class RecruitmentScheduleId {
  private constructor(private readonly value: string) {}

  static generate(): RecruitmentScheduleId {
    return new RecruitmentScheduleId(randomUUID());
  }

  static from(value: string): Result<RecruitmentScheduleId, InvalidRecruitmentScheduleIdError> {
    if (!isUuidV4(value)) {
      return err({ type: "INVALID_RECRUITMENT_SCHEDULE_ID_FORMAT", value });
    }
    return ok(new RecruitmentScheduleId(value));
  }

  toString(): string {
    return this.value;
  }

  equals(other: RecruitmentScheduleId): boolean {
    return this.value === other.value;
  }
}

export interface InvalidRecruitmentScheduleIdError {
  readonly type: "INVALID_RECRUITMENT_SCHEDULE_ID_FORMAT";
  readonly value: string;
}
