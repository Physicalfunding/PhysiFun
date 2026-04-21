import { type Result, err, ok } from "../../shared/result";

/**
 * ハッシュ化済みパスワード値オブジェクト (#140 / #144)
 *
 * ドメイン層では平文パスワードを扱わず、ハッシュ済み文字列のみを保持する。
 * ハッシュ化ロジック (bcrypt/argon2 等) は infrastructure 層の責務。
 *
 * - 空文字を拒否
 * - ハッシュアルゴリズムの種類は検証しない (infrastructure 層の責務)
 */
export class HashedPassword {
  private constructor(private readonly value: string) {}

  static from(raw: string): Result<HashedPassword, HashedPasswordError> {
    if (raw.length === 0) {
      return err({ type: "HASH_REQUIRED" });
    }
    return ok(new HashedPassword(raw));
  }

  /**
   * 永続化のために生ハッシュ値を取り出す。
   * Repository 実装からのみ呼ぶこと。ログやエラーメッセージでは使わない。
   */
  unwrap(): string {
    return this.value;
  }

  /**
   * 誤ってログ / template literal / JSON.stringify で値が漏れないよう
   * マスク文字列を返す。永続化は {@link unwrap} を使うこと。
   */
  toString(): string {
    return "[HashedPassword]";
  }

  /**
   * ハッシュ文字列同士の同一性チェック (重複登録検知など)。
   * ログイン認証には使わない (infrastructure 層の `bcrypt.compare()` を使う)。
   * タイミング攻撃耐性は不要な用途のみを想定。
   */
  equals(other: HashedPassword): boolean {
    return this.value === other.value;
  }
}

export type HashedPasswordError = { readonly type: "HASH_REQUIRED" };
