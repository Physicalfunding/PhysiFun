import { type Result, type AppError, ok, err, validationError } from "../../shared/result";

/**
 * Email value object
 * Represents a validated email address
 */
export class Email {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  /**
   * Creates a new Email value object
   * @param value The email address string
   * @returns Result with Email or validation error
   */
  static create(value: string): Result<Email, AppError> {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return err(validationError("メールアドレスを入力してください"));
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      return err(validationError("無効なメールアドレス形式です"));
    }

    return ok(new Email(normalized));
  }

  /**
   * Checks equality with another Email
   */
  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
