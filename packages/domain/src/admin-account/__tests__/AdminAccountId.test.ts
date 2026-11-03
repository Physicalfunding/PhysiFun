import { describe, expect, it } from "vitest";
import { AdminAccountId } from "../value-objects/AdminAccountId";

describe("AdminAccountId", () => {
  it("from() で有効な UUID v4 を復元できる", () => {
    const raw = "550e8400-e29b-41d4-a716-446655440000";
    const result = AdminAccountId.from(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toString()).toBe(raw);
    }
  });

  it("from() で有効な UUID v7 を復元できる", () => {
    const raw = "019a4b2e-7c41-7d3a-9f12-3b4c5d6e7f80";
    const result = AdminAccountId.from(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toString()).toBe(raw);
    }
  });

  it("from() で無効な文字列はエラー", () => {
    const result = AdminAccountId.from("not-a-uuid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_ADMIN_ACCOUNT_ID_FORMAT");
    }
  });

  it("from() で UUID v1 はエラー", () => {
    const result = AdminAccountId.from("550e8400-e29b-11d4-a716-446655440000");
    expect(result.ok).toBe(false);
  });
});
