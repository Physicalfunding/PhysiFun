import { randomUUID } from "node:crypto";
import { type Result, err, ok } from "../../shared/result";

/**
 * LeaderApplicationId 値オブジェクト
 *
 * リーダー応募を一意に識別する ID。UUID v4 形式。
 */
export class LeaderApplicationId {
  private constructor(private readonly value: string) {}

  /** 新規 ID を生成（UUID v4） */
  static generate(): LeaderApplicationId {
    return new LeaderApplicationId(randomUUID());
  }

  /** 既存文字列から復元 */
  static from(value: string): Result<LeaderApplicationId, InvalidLeaderApplicationIdError> {
    if (!UUID_V4_REGEX.test(value)) {
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

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
