import { describe, expect, it } from "@jest/globals";
import { LeaderApplicationId } from "../value-objects/LeaderApplicationId";

describe("LeaderApplicationId", () => {
  describe("generate", () => {
    it("UUID v4 形式の新規 ID を生成する", () => {
      const id = LeaderApplicationId.generate();
      expect(id.toString()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("呼び出しごとに異なる ID を返す", () => {
      const a = LeaderApplicationId.generate();
      const b = LeaderApplicationId.generate();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("from", () => {
    it("有効な UUID v4 から復元できる", () => {
      const valid = "550e8400-e29b-41d4-a716-446655440000";
      const result = LeaderApplicationId.from(valid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toString()).toBe(valid);
      }
    });

    it("UUID でない文字列はエラー", () => {
      const result = LeaderApplicationId.from("not-a-uuid");
      expect(result.ok).toBe(false);
    });

    it("UUID v1 はエラー", () => {
      const result = LeaderApplicationId.from("550e8400-e29b-11d4-a716-446655440000");
      expect(result.ok).toBe(false);
    });
  });

  describe("equals", () => {
    it("同じ値なら true", () => {
      const value = "550e8400-e29b-41d4-a716-446655440000";
      const a = LeaderApplicationId.from(value);
      const b = LeaderApplicationId.from(value);
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });
  });
});
