import { type Result, err, ok } from "../../shared/result";
import { generateUuidV7, isUuid } from "../../shared/uuid";

/**
 * ProjectId 値オブジェクト
 *
 * プロジェクトを一意に識別する ID。UUID（v4 か v7）の形式。
 */
export class ProjectId {
  private constructor(private readonly value: string) {}

  static generate(): ProjectId {
    return new ProjectId(generateUuidV7());
  }

  static from(value: string): Result<ProjectId, InvalidProjectIdError> {
    if (!isUuid(value)) {
      return err({ type: "INVALID_PROJECT_ID_FORMAT", value });
    }
    return ok(new ProjectId(value));
  }

  toString(): string {
    return this.value;
  }

  equals(other: ProjectId): boolean {
    return this.value === other.value;
  }
}

export interface InvalidProjectIdError {
  readonly type: "INVALID_PROJECT_ID_FORMAT";
  readonly value: string;
}
