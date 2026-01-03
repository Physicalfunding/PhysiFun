import { type Result, type AppError, ok, err, validationError } from "../../shared/result";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * MessageId value object
 * Represents a unique identifier for a message (UUID format)
 */
export class MessageId {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  static create(value: string): Result<MessageId, AppError> {
    if (!value) {
      return err(validationError("メッセージIDが指定されていません"));
    }

    if (!UUID_REGEX.test(value)) {
      return err(validationError("無効なメッセージID形式です"));
    }

    return ok(new MessageId(value));
  }

  static generate(): MessageId {
    const uuid = crypto.randomUUID();
    return new MessageId(uuid);
  }

  equals(other: MessageId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
