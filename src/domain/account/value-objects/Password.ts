import bcrypt from "bcryptjs";
import { type Result, type AppError, ok, err, validationError } from "../../shared/result";

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Password value object
 * Represents a plain text password before hashing
 */
export class Password {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  /**
   * Creates a new Password value object
   * @param value The plain text password
   * @returns Result with Password or validation error
   */
  static create(value: string): Result<Password, AppError> {
    const trimmed = value.trim();

    if (!trimmed) {
      return err(validationError("パスワードを入力してください"));
    }

    if (trimmed.length < MIN_PASSWORD_LENGTH) {
      return err(validationError(`パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`));
    }

    return ok(new Password(value));
  }

  /**
   * Hashes the password using bcrypt
   * @returns HashedPassword value object
   */
  async hash(): Promise<HashedPassword> {
    const hash = await bcrypt.hash(this._value, BCRYPT_ROUNDS);
    return HashedPassword.fromHash(hash);
  }
}

/**
 * HashedPassword value object
 * Represents a bcrypt hashed password
 */
export class HashedPassword {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  /**
   * Creates a HashedPassword from an existing hash
   * @param hash The bcrypt hash string
   * @returns HashedPassword value object
   */
  static fromHash(hash: string): HashedPassword {
    return new HashedPassword(hash);
  }

  /**
   * Verifies a plain text password against this hash
   * @param plainPassword The plain text password to verify
   * @returns true if password matches, false otherwise
   */
  async verify(plainPassword: string): Promise<boolean> {
    if (!plainPassword) {
      return false;
    }
    return bcrypt.compare(plainPassword, this._value);
  }
}
