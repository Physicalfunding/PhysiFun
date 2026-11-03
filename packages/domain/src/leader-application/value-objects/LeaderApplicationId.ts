import { type Result, err, ok } from "../../shared/result";
import { generateUuidV7, isUuid } from "../../shared/uuid";

/**
 * LeaderApplicationId 値オブジェクト
 *
 * リーダー応募を一意に識別する ID。UUID（v4 か v7）の形式。
 */
export class LeaderApplicationId {
  private constructor(private readonly value: string) {}

  /** 新規 ID を生成（UUID v7） */
  static generate(): LeaderApplicationId {
    return new LeaderApplicationId(generateUuidV7());
  }

  /** 既存文字列から復元 */
  static from(value: string): Result<LeaderApplicationId, InvalidLeaderApplicationIdError> {
    if (!isUuid(value)) {
      return err({ type: "INVALID_LEADER_APPLICATION_ID_FORMAT", value });
    }
    return ok(new LeaderApplicationId(value));
  }

  toString(): string {
    return this.value;
  }

  equals(other: LeaderApplicationId): boolean {
    return this.value === other.value;
  }
}

export interface InvalidLeaderApplicationIdError {
  readonly type: "INVALID_LEADER_APPLICATION_ID_FORMAT";
  readonly value: string;
}
