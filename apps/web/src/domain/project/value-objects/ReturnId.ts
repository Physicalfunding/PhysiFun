import { type Result, type AppError, ok, err, validationError } from "../../shared/result";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ReturnId value object
 * Represents a unique identifier for a return/reward (UUID format)
 */
export class ReturnId {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  static create(value: string): Result<ReturnId, AppError> {
    if (!value) {
      return err(validationError("リターンIDが指定されていません"));
    }

    if (!UUID_REGEX.test(value)) {
      return err(validationError("無効なリターンID形式です"));
    }

    return ok(new ReturnId(value));
  }

  static generate(): ReturnId {
    const uuid = crypto.randomUUID();
    return new ReturnId(uuid);
  }

  equals(other: ReturnId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
