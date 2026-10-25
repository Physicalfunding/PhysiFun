import { describe, expect, it } from "vitest";
import { SupportRecruitmentId } from "../value-objects/SupportRecruitmentId";

describe("SupportRecruitmentId", () => {
  it("generate() で UUID v4 形式の ID が生成される", () => {
    const id = SupportRecruitmentId.generate();
    expect(id.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("from() で有効な UUID v4 を復元できる", () => {
    const raw = "550e8400-e29b-41d4-a716-446655440000";
    const result = SupportRecruitmentId.from(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toString()).toBe(raw);
    }
  });

  it("from() で無効な文字列はエラー", () => {
    const result = SupportRecruitmentId.from("not-a-uuid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_SUPPORT_RECRUITMENT_ID_FORMAT");
    }
  });

  it("equals() は値が同じなら true、違えば false", () => {
    const raw = "550e8400-e29b-41d4-a716-446655440000";
    const a = SupportRecruitmentId.from(raw);
    const b = SupportRecruitmentId.from(raw);
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    expect(SupportRecruitmentId.generate().equals(SupportRecruitmentId.generate())).toBe(false);
  });
});
