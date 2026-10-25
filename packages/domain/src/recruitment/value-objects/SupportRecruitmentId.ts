import { randomUUID } from "node:crypto";
import { type Result, err, ok } from "../../shared/result";
import { isUuidV4 } from "../../shared/uuid";

/**
 * SupportRecruitmentId 値オブジェクト
 *
 * サポート募集を一意に識別する ID。UUID v4 形式。
 */
export class SupportRecruitmentId {
  private constructor(private readonly value: string) {}

  static generate(): SupportRecruitmentId {
    return new SupportRecruitmentId(randomUUID());
  }

  static from(value: string): Result<SupportRecruitmentId, InvalidSupportRecruitmentIdError> {
    if (!isUuidV4(value)) {
      return err({ type: "INVALID_SUPPORT_RECRUITMENT_ID_FORMAT", value });
    }
    return ok(new SupportRecruitmentId(value));
  }

  toString(): string {
    return this.value;
  }

  equals(other: SupportRecruitmentId): boolean {
    return this.value === other.value;
  }
}

export interface InvalidSupportRecruitmentIdError {
  readonly type: "INVALID_SUPPORT_RECRUITMENT_ID_FORMAT";
  readonly value: string;
}
