import { randomUUID } from "node:crypto";
import { type Result, err, ok } from "../../shared/result";

/**
 * AccountId 値オブジェクト
 *
 * Account を一意に識別する ID。UUID v4 形式で表現する。
 *
 * - 生成は `generate()` でドメイン層内部でも可能（永続化を待たない）
 * - DB からの復元は `from()` でバリデーション付きで復元する
 * - v4 を採用する理由:
 *   - セキュリティ（連番推測・総数露呈の防止）
 *   - 分散耐性（将来のシャーディング・マイクロサービス分離）
 *   - Prisma schema が `@default(uuid())`（v4）で統一
 */
export class AccountId {
  private constructor(private readonly value: string) {}

  /**
   * 新規 AccountId を生成する（UUID v4）
   */
  static generate(): AccountId {
    return new AccountId(randomUUID());
  }

  /**
   * 既存の文字列から AccountId を復元する（DB / API 入力経由）
   *
   * UUID v4 形式でない場合は `InvalidAccountIdError` を返す。
   */
  static from(value: string): Result<AccountId, InvalidAccountIdError> {
    if (!UUID_V4_REGEX.test(value)) {
      return err({ type: "INVALID_ACCOUNT_ID_FORMAT", value });
    }
    return ok(new AccountId(value));
  }

  toString(): string {
    return this.value;
  }

  equals(other: AccountId): boolean {
    return this.value === other.value;
  }
}

export interface InvalidAccountIdError {
  readonly type: "INVALID_ACCOUNT_ID_FORMAT";
  readonly value: string;
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
