import { type Result, err, ok } from "../../shared/result";

/**
 * ハッシュ化済みリカバリコード値オブジェクト (#140 / #144)
 *
 * 2FA リカバリコードは原本を表示するのは生成時の 1 度のみ。
 * DB 保存時はハッシュ化 (bcrypt 等) してから格納する。
 *
 * - 空文字を拒否
 * - ハッシュアルゴリズムは infrastructure 層に委ねる
 */
export class RecoveryCodeHash {
  private constructor(private readonly value: string) {}

  static from(raw: string): Result<RecoveryCodeHash, RecoveryCodeHashError> {
    if (raw.length === 0) {
      return err({ type: "RECOVERY_CODE_HASH_REQUIRED" });
    }
    return ok(new RecoveryCodeHash(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: RecoveryCodeHash): boolean {
    return this.value === other.value;
  }
}

export type RecoveryCodeHashError = { readonly type: "RECOVERY_CODE_HASH_REQUIRED" };
