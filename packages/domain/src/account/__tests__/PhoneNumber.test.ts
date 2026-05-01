import { describe, expect, it } from "@jest/globals";
import { PHONE_NUMBER_MAX_LENGTH, PhoneNumber } from "../value-objects/PhoneNumber";

describe("PhoneNumber", () => {
  describe("create", () => {
    it("null は ok かつ value=null を返す", () => {
      const result = PhoneNumber.create(null);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it("undefined は ok かつ value=null を返す", () => {
      const result = PhoneNumber.create(undefined);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it("空文字は ok かつ value=null を返す（null と等価扱い）", () => {
      const result = PhoneNumber.create("");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it("空白のみは ok かつ value=null を返す", () => {
      const result = PhoneNumber.create("   ");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it("一般的な日本の電話番号（ハイフン込み）を受理する", () => {
      const result = PhoneNumber.create("090-1234-5678");
      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.toString()).toBe("090-1234-5678");
      }
    });

    it("国際表記（プラス + 国番号）を受理する", () => {
      const result = PhoneNumber.create("+81-90-1234-5678");
      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.toString()).toBe("+81-90-1234-5678");
      }
    });

    it("前後の空白はトリムする", () => {
      const result = PhoneNumber.create("  09012345678  ");
      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.toString()).toBe("09012345678");
      }
    });

    it("20 文字超はエラー", () => {
      const result = PhoneNumber.create("1".repeat(PHONE_NUMBER_MAX_LENGTH + 1));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("PHONE_NUMBER_TOO_LONG");
      }
    });

    it("ちょうど 20 文字は OK", () => {
      const result = PhoneNumber.create("1".repeat(PHONE_NUMBER_MAX_LENGTH));
      expect(result.ok).toBe(true);
    });

    it("不正文字（英字）はエラー", () => {
      const result = PhoneNumber.create("090-abcd-5678");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("PHONE_NUMBER_INVALID_CHARACTERS");
      }
    });
  });

  describe("equals", () => {
    it("同じ値なら true", () => {
      const a = PhoneNumber.create("090-1234-5678");
      const b = PhoneNumber.create("090-1234-5678");
      if (a.ok && b.ok && a.value && b.value) {
        expect(a.value.equals(b.value)).toBe(true);
      }
    });

    it("異なる値なら false", () => {
      const a = PhoneNumber.create("090-1234-5678");
      const b = PhoneNumber.create("080-9876-5432");
      if (a.ok && b.ok && a.value && b.value) {
        expect(a.value.equals(b.value)).toBe(false);
      }
    });
  });
});
