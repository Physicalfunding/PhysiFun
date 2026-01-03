import { type Result, type AppError, ok, err, validationError } from "../../shared/result";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ProjectId value object
 * Represents a unique identifier for a project (UUID format)
 */
export class ProjectId {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  /**
   * Creates a ProjectId from an existing UUID string
   */
  static create(value: string): Result<ProjectId, AppError> {
    if (!value) {
      return err(validationError("プロジェクトIDが指定されていません"));
    }

    if (!UUID_REGEX.test(value)) {
      return err(validationError("無効なプロジェクトID形式です"));
    }

    return ok(new ProjectId(value));
  }

  /**
   * Generates a new unique ProjectId
   */
  static generate(): ProjectId {
    const uuid = crypto.randomUUID();
    return new ProjectId(uuid);
  }

  equals(other: ProjectId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
