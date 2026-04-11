import { type Result, type AppError, ok, err, validationError } from "../../shared/result";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ScheduleId value object
 * Represents a unique identifier for a schedule (UUID format)
 */
export class ScheduleId {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  static create(value: string): Result<ScheduleId, AppError> {
    if (!value) {
      return err(validationError("スケジュールIDが指定されていません"));
    }

    if (!UUID_REGEX.test(value)) {
      return err(validationError("無効なスケジュールID形式です"));
    }

    return ok(new ScheduleId(value));
  }

  static generate(): ScheduleId {
    const uuid = crypto.randomUUID();
    return new ScheduleId(uuid);
  }

  equals(other: ScheduleId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
