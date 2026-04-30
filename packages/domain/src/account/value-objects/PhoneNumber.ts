import { type Result, err, ok } from "../../shared/result";

/**
 * 電話番号の最大文字数（Issue #192 仮値: 20 文字）
 *
 * ハイフン込み・国際表記（`+81-90-1234-5678` 等）を許容するため、
 * 単純な数字桁数ではなく文字列長で制約する。
 */
export const PHONE_NUMBER_MAX_LENGTH = 20;

/**
 * 電話番号として許容する文字（数字 / ハイフン / プラス / 半角スペース / 括弧）
 *
 * Issue #192 の方針:
 *   - フォーマット検証は緩め
 *   - ハイフン込み・国際表記を許容
 *   - 〜20 文字
 */
const PHONE_NUMBER_REGEX = /^[0-9+\-\s()]+$/;

/**
 * PhoneNumber 値オブジェクトのエラー型
 */
export type PhoneNumberError =
  | { readonly type: "PHONE_NUMBER_TOO_LONG"; readonly maxLength: number }
  | { readonly type: "PHONE_NUMBER_INVALID_CHARACTERS"; readonly value: string };

/**
 * PhoneNumber 値オブジェクト
 *
 * Account の電話番号を表す。Phase 1 のフォーマット検証は緩く、以下のみ:
 *   - 〜20 文字
 *   - 数字 / `-` / `+` / 半角スペース / `()` のみ許容
 *
 * 入力時の前後空白はトリム。空文字は `null` 等価として扱うため、
 * `create(null)` または `create("")` で「未設定」を表す。
 *
 * 値は不変で、`equals()` で比較する。
 */
export class PhoneNumber {
  private constructor(private readonly value: string) {}

  /**
   * PhoneNumber を生成する。
   *
   * @param input 入力値。`null` / `undefined` / 空文字（trim 後）は「未設定」となり `null` を返す
   * @returns 設定されている場合は `PhoneNumber` を、未設定の場合は `null` を ok で包んで返す
   */
  static create(input: string | null | undefined): Result<PhoneNumber | null, PhoneNumberError> {
    if (input === null || input === undefined) {
      return ok(null);
    }
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return ok(null);
    }
    if (trimmed.length > PHONE_NUMBER_MAX_LENGTH) {
      return err({ type: "PHONE_NUMBER_TOO_LONG", maxLength: PHONE_NUMBER_MAX_LENGTH });
    }
    if (!PHONE_NUMBER_REGEX.test(trimmed)) {
      return err({ type: "PHONE_NUMBER_INVALID_CHARACTERS", value: trimmed });
    }
    return ok(new PhoneNumber(trimmed));
  }

  toString(): string {
    return this.value;
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }
}
