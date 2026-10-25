import { describe, expect, it } from "vitest";
import { RecruitmentScheduleId } from "../value-objects/RecruitmentScheduleId";

describe("RecruitmentScheduleId", () => {
  it("generate() で UUID v4 形式の ID が生成される", () => {
    const id = RecruitmentScheduleId.generate();
    expect(id.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("from() で有効な UUID v4 を復元できる", () => {
    const raw = "550e8400-e29b-41d4-a716-446655440000";
    const result = RecruitmentScheduleId.from(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toString()).toBe(raw);
    }
  });

  it("from() で無効な文字列はエラー", () => {
    const result = RecruitmentScheduleId.from("not-a-uuid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_RECRUITMENT_SCHEDULE_ID_FORMAT");
    }
  });

  it("equals() は値が同じなら true、違えば false", () => {
    const raw = "550e8400-e29b-41d4-a716-446655440000";
    const a = RecruitmentScheduleId.from(raw);
    const b = RecruitmentScheduleId.from(raw);
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    expect(RecruitmentScheduleId.generate().equals(RecruitmentScheduleId.generate())).toBe(false);
  });
});
