import { type Result, err, ok } from "../../shared/result";
import { generateUuidV7, isUuid } from "../../shared/uuid";

/**
 * AccountId 値オブジェクト
 *
 * Account を一意に識別する ID。UUID（v4 か v7）の形式で表現する。
 *
 * - 生成は `generate()` でドメイン層内部でも可能（永続化を待たない）
 * - DB からの復元は `from()` でバリデーション付きで復元する
 * - 連番ではなく UUID を採用する理由:
 *   - セキュリティ（連番推測・総数露呈の防止）
 *   - 分散耐性（将来のシャーディング・マイクロサービス分離）
 * - 新しく作る ID を v7 にする理由（#358）:
 *   - 先頭が作成時刻なので、主キーのインデックスへの書き込みが時刻順に並び、散らばらない
 *   - 引き換えに、ID から作成時刻（ミリ秒）が読める。乱数は 74 bit あるので推測はできない
 *   - #358 より前に作った ID は v4 のまま残るため、`from()` は v4 も通す
 */
export class AccountId {
  private constructor(private readonly value: string) {}

  /**
   * 新規 AccountId を生成する（UUID v7）
   */
  static generate(): AccountId {
    return new AccountId(generateUuidV7());
  }

  /**
   * 既存の文字列から AccountId を復元する（DB / API 入力経由）
   *
   * UUID（v4 か v7）の形式でない場合は `InvalidAccountIdError` を返す。
   */
  static from(value: string): Result<AccountId, InvalidAccountIdError> {
    if (!isUuid(value)) {
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
