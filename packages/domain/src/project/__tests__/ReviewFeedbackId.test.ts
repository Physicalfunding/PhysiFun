import { describe, expect, it } from "@jest/globals";
import { ReviewFeedbackId } from "../value-objects/ReviewFeedbackId";

describe("ReviewFeedbackId", () => {
  it("generate() で UUID v4 形式の ID が生成される", () => {
    const id = ReviewFeedbackId.generate();
    expect(id.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("from() で有効な UUID v4 を復元できる", () => {
    const raw = "550e8400-e29b-41d4-a716-446655440000";
    const result = ReviewFeedbackId.from(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toString()).toBe(raw);
    }
  });

  it("from() で無効な文字列はエラー", () => {
    const result = ReviewFeedbackId.from("invalid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_REVIEW_FEEDBACK_ID_FORMAT");
    }
  });

  it("equals() で同じ値なら true", () => {
    const raw = "550e8400-e29b-41d4-a716-446655440000";
    const a = ReviewFeedbackId.from(raw);
    const b = ReviewFeedbackId.from(raw);
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
  });
});
