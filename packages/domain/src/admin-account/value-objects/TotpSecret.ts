import { type Result, err, ok } from "../../shared/result";

/**
 * 暗号化済み TOTP シークレット値オブジェクト (#140 / #144)
 *
 * - ドメイン層では平文シークレットを扱わない
 * - 保存される値は infrastructure 層で暗号化された ciphertext
 * - 空文字を拒否する
 *
 * TOTP 生成・検証および暗号化/復号のロジックは infrastructure / application 層の責務。
 */
export class TotpSecret {
  private constructor(private readonly value: string) {}

  static from(raw: string): Result<TotpSecret, TotpSecretError> {
    if (raw.length === 0) {
      return err({ type: "TOTP_SECRET_REQUIRED" });
    }
    return ok(new TotpSecret(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: TotpSecret): boolean {
    return this.value === other.value;
  }
}

export type TotpSecretError = { readonly type: "TOTP_SECRET_REQUIRED" };
