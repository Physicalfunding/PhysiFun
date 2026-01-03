import { type Result, type AppError, ok, err, validationError } from "../../shared/result";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * UserId value object
 * Represents a unique identifier for a user (UUID format)
 */
export class UserId {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  /**
   * Creates a UserId from an existing UUID string
   * @param value The UUID string
   * @returns Result with UserId or validation error
   */
  static create(value: string): Result<UserId, AppError> {
    if (!value) {
      return err(validationError("ユーザーIDが指定されていません"));
    }

    if (!UUID_REGEX.test(value)) {
      return err(validationError("無効なユーザーID形式です"));
    }

    return ok(new UserId(value));
  }

  /**
   * Generates a new unique UserId
   * @returns New UserId with generated UUID
   */
  static generate(): UserId {
    const uuid = crypto.randomUUID();
    return new UserId(uuid);
  }

  /**
   * Checks equality with another UserId
   */
  equals(other: UserId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
