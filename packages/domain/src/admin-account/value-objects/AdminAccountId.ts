import { randomUUID } from "node:crypto";
import { type Result, err, ok } from "../../shared/result";
import { isUuidV4 } from "../../shared/uuid";

/**
 * AdminAccountId 値オブジェクト (#140 / #144)
 *
 * 運営アカウント (AdminAccount) を一意に識別する ID。
 * Account (一般ユーザー) とは別名前空間の UUID v4 として運用する。
 *
 * - 生成は `generate()` でドメイン層内部でも可能（永続化を待たない）
 * - DB / 入力経由の復元は `from()` でバリデーション付きで行う
 */
export class AdminAccountId {
  private constructor(private readonly value: string) {}

  static generate(): AdminAccountId {
    return new AdminAccountId(randomUUID());
  }

  static from(value: string): Result<AdminAccountId, InvalidAdminAccountIdError> {
    if (!isUuidV4(value)) {
      return err({ type: "INVALID_ADMIN_ACCOUNT_ID_FORMAT", value });
    }
    return ok(new AdminAccountId(value));
  }

  toString(): string {
    return this.value;
  }

  equals(other: AdminAccountId): boolean {
    return this.value === other.value;
  }
}

export interface InvalidAdminAccountIdError {
  readonly type: "INVALID_ADMIN_ACCOUNT_ID_FORMAT";
  readonly value: string;
}
