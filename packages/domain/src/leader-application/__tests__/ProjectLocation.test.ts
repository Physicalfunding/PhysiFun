import { describe, expect, it } from "@jest/globals";
import { ProjectLocation } from "../../shared/value-objects/ProjectLocation";

describe("ProjectLocation", () => {
  describe("create", () => {
    it("都道府県コードのみで生成できる", () => {
      const result = ProjectLocation.create({ prefectureCode: "13" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prefectureCode).toBe("13");
        expect(result.value.municipality).toBeNull();
      }
    });

    it("都道府県コード + 市区町村で生成できる", () => {
      const result = ProjectLocation.create({
        prefectureCode: "14",
        municipality: "横浜市西区",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prefectureCode).toBe("14");
        expect(result.value.municipality).toBe("横浜市西区");
      }
    });

    it("市区町村の前後空白はトリムされる", () => {
      const result = ProjectLocation.create({
        prefectureCode: "13",
        municipality: "  新宿区  ",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.municipality).toBe("新宿区");
      }
    });

    it("トリム後に空文字の市区町村は null として扱う", () => {
      const result = ProjectLocation.create({
        prefectureCode: "01",
        municipality: "   ",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.municipality).toBeNull();
      }
    });

    it("都道府県コード 01（最小）で OK", () => {
      const result = ProjectLocation.create({ prefectureCode: "01" });
      expect(result.ok).toBe(true);
    });

    it("都道府県コード 47（最大）で OK", () => {
      const result = ProjectLocation.create({ prefectureCode: "47" });
      expect(result.ok).toBe(true);
    });

    it("都道府県コード 00 はエラー", () => {
      const result = ProjectLocation.create({ prefectureCode: "00" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("INVALID_PREFECTURE_CODE");
      }
    });

    it("都道府県コード 48 はエラー", () => {
      const result = ProjectLocation.create({ prefectureCode: "48" });
      expect(result.ok).toBe(false);
    });

    it("都道府県コードが 3 桁はエラー", () => {
      const result = ProjectLocation.create({ prefectureCode: "013" });
      expect(result.ok).toBe(false);
    });

    it("都道府県コードが空文字はエラー", () => {
      const result = ProjectLocation.create({ prefectureCode: "" });
      expect(result.ok).toBe(false);
    });

    it("市区町村 50 文字はトリム後も OK", () => {
      const municipality = "あ".repeat(50);
      const result = ProjectLocation.create({
        prefectureCode: "13",
        municipality,
      });
      expect(result.ok).toBe(true);
    });

    it("市区町村 51 文字はエラー", () => {
      const municipality = "あ".repeat(51);
      const result = ProjectLocation.create({
        prefectureCode: "13",
        municipality,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("MUNICIPALITY_TOO_LONG");
      }
    });
  });

  describe("equals", () => {
    it("同じ都道府県 + 同じ市区町村なら true", () => {
      const a = ProjectLocation.create({
        prefectureCode: "13",
        municipality: "新宿区",
      });
      const b = ProjectLocation.create({
        prefectureCode: "13",
        municipality: "新宿区",
      });
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it("市区町村が異なれば false", () => {
      const a = ProjectLocation.create({
        prefectureCode: "13",
        municipality: "新宿区",
      });
      const b = ProjectLocation.create({
        prefectureCode: "13",
        municipality: "渋谷区",
      });
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });

    it("都道府県が異なれば false", () => {
      const a = ProjectLocation.create({ prefectureCode: "13" });
      const b = ProjectLocation.create({ prefectureCode: "14" });
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });

    it("null vs 空相当（null）は等しい", () => {
      const a = ProjectLocation.create({ prefectureCode: "13" });
      const b = ProjectLocation.create({
        prefectureCode: "13",
        municipality: null,
      });
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });
  });
});
