import { type Result, type AppError, ok, err, validationError } from "../../shared/result";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ParticipationId value object
 * Represents a unique identifier for a participation (UUID format)
 */
export class ParticipationId {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  static create(value: string): Result<ParticipationId, AppError> {
    if (!value) {
      return err(validationError("参加申し込みIDが指定されていません"));
    }

    if (!UUID_REGEX.test(value)) {
      return err(validationError("無効な参加申し込みID形式です"));
    }

    return ok(new ParticipationId(value));
  }

  static generate(): ParticipationId {
    const uuid = crypto.randomUUID();
    return new ParticipationId(uuid);
  }

  equals(other: ParticipationId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
