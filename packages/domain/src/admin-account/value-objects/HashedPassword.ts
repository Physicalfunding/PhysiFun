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

  toString(): string {
    return this.value;
  }

  equals(other: HashedPassword): boolean {
    return this.value === other.value;
  }
}

export type HashedPasswordError = { readonly type: "HASH_REQUIRED" };
