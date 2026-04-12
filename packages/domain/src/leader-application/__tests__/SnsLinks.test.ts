import { describe, expect, it } from "@jest/globals";
import { SnsLinks } from "../value-objects/SnsLinks";

describe("SnsLinks", () => {
  describe("create", () => {
    it("全項目空で生成できる（全 null）", () => {
      const result = SnsLinks.create({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isEmpty()).toBe(true);
      }
    });

    it("一部項目のみで生成できる", () => {
      const result = SnsLinks.create({ x: "https://x.com/example" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.x).toBe("https://x.com/example");
        expect(result.value.instagram).toBeNull();
      }
    });

    it("前後の空白はトリムされる", () => {
      const result = SnsLinks.create({ website: "  https://example.com  " });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.website).toBe("https://example.com");
      }
    });

    it("トリム後空文字は null として扱う", () => {
      const result = SnsLinks.create({ x: "   " });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.x).toBeNull();
      }
    });

    it("500 文字ちょうどは OK", () => {
      const url = "https://example.com/" + "a".repeat(500 - "https://example.com/".length);
      const result = SnsLinks.create({ website: url });
      expect(result.ok).toBe(true);
    });

    it("501 文字はエラー", () => {
      const result = SnsLinks.create({ website: "a".repeat(501) });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("SNS_URL_TOO_LONG");
        expect(result.error.field).toBe("website");
      }
    });

    it("エラー時はどのフィールドが違反かが分かる", () => {
      const result = SnsLinks.create({
        x: "a".repeat(501),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.field).toBe("x");
      }
    });
  });

  describe("isEmpty", () => {
    it("全 null なら true", () => {
      const result = SnsLinks.create({});
      expect(result.ok && result.value.isEmpty()).toBe(true);
    });

    it("1 つでも値があれば false", () => {
      const result = SnsLinks.create({ x: "https://x.com/a" });
      expect(result.ok && !result.value.isEmpty()).toBe(true);
    });
  });

  describe("equals", () => {
    it("同じ内容なら true", () => {
      const a = SnsLinks.create({
        x: "https://x.com/a",
        website: "https://example.com",
      });
      const b = SnsLinks.create({
        x: "https://x.com/a",
        website: "https://example.com",
      });
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it("1 つ違えば false", () => {
      const a = SnsLinks.create({ x: "https://x.com/a" });
      const b = SnsLinks.create({ x: "https://x.com/b" });
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });
  });
});
