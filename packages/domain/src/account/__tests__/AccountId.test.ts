import { describe, expect, it } from "@jest/globals";
import { AccountId } from "../value-objects/AccountId";

describe("AccountId", () => {
  describe("generate", () => {
    it("UUID v4 形式の新規 ID を生成する", () => {
      const id = AccountId.generate();
      expect(id.toString()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("呼び出しごとに異なる ID を返す", () => {
      const a = AccountId.generate();
      const b = AccountId.generate();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("from", () => {
    it("有効な UUID v4 文字列から復元できる", () => {
      const valid = "550e8400-e29b-41d4-a716-446655440000";
      const result = AccountId.from(valid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toString()).toBe(valid);
      }
    });

    it("空文字はエラー", () => {
      const result = AccountId.from("");
      expect(result.ok).toBe(false);
    });

    it("UUID ではない文字列はエラー", () => {
      const result = AccountId.from("not-a-uuid");
      expect(result.ok).toBe(false);
    });

    it("UUID v1（version bit が 4 ではない）はエラー", () => {
      // v1 UUID: 3 桁目の先頭が 1
      const v1 = "550e8400-e29b-11d4-a716-446655440000";
      const result = AccountId.from(v1);
      expect(result.ok).toBe(false);
    });

    it("variant bit が不正な UUID はエラー", () => {
      // variant bit は 8/9/a/b のいずれか。ここは c で不正
      const invalid = "550e8400-e29b-41d4-c716-446655440000";
      const result = AccountId.from(invalid);
      expect(result.ok).toBe(false);
    });
  });

  describe("equals", () => {
    it("同じ値なら true", () => {
      const value = "550e8400-e29b-41d4-a716-446655440000";
      const a = AccountId.from(value);
      const b = AccountId.from(value);
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it("異なる値なら false", () => {
      const a = AccountId.from("550e8400-e29b-41d4-a716-446655440000");
      const b = AccountId.from("550e8400-e29b-41d4-a716-446655440001");
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });
  });
});
