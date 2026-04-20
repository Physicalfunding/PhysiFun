import { type Result, err, ok } from "../../shared/result";

/**
 * AdminAccount のメールアドレス上限。Account と同じ RFC 上限に合わせて 254 文字とする。
 */
export const ADMIN_ACCOUNT_EMAIL_MAX_LENGTH = 254;

/**
 * AdminAccountEmail 値オブジェクト
 *
 * - 前後空白は trim
 * - 大文字小文字を区別しない運用なので toLowerCase で正規化
 * - 最低限のフォーマット（"x@y" 構造）をチェック
 *
 * 厳密なメール検証は送信時 (Resend 等) に任せ、ドメイン層では正規化と
 * 明らかな不正のみを弾く。
 */
export class AdminAccountEmail {
  private constructor(private readonly value: string) {}

  static from(raw: string): Result<AdminAccountEmail, AdminAccountEmailError> {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 0) {
      return err({ type: "EMAIL_REQUIRED" });
    }
    if (trimmed.length > ADMIN_ACCOUNT_EMAIL_MAX_LENGTH) {
      return err({
        type: "EMAIL_TOO_LONG",
        maxLength: ADMIN_ACCOUNT_EMAIL_MAX_LENGTH,
        actualLength: trimmed.length,
      });
    }
    // 最低限のフォーマット: 'a@b.c' 相当
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return err({ type: "EMAIL_INVALID_FORMAT", value: trimmed });
    }
    return ok(new AdminAccountEmail(trimmed));
  }

  toString(): string {
    return this.value;
  }

  equals(other: AdminAccountEmail): boolean {
    return this.value === other.value;
  }
}

export type AdminAccountEmailError =
  | { readonly type: "EMAIL_REQUIRED" }
  | { readonly type: "EMAIL_TOO_LONG"; readonly maxLength: number; readonly actualLength: number }
  | { readonly type: "EMAIL_INVALID_FORMAT"; readonly value: string };
