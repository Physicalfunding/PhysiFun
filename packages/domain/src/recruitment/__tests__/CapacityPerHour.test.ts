import { describe, expect, it } from "vitest";
import { CAPACITY_PER_HOUR_LIMITS, CapacityPerHour } from "../value-objects/CapacityPerHour";

describe("CapacityPerHour", () => {
  it.each([CAPACITY_PER_HOUR_LIMITS.min, 10, CAPACITY_PER_HOUR_LIMITS.max])(
    "範囲内の整数 %d で生成できる",
    (value) => {
      const result = CapacityPerHour.from(value);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe(value);
      }
    }
  );

  it.each([0, -1, CAPACITY_PER_HOUR_LIMITS.max + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "範囲外・整数でない値 %d はエラー",
    (value) => {
      const result = CapacityPerHour.from(value);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "INVALID_CAPACITY_PER_HOUR",
          value,
          min: CAPACITY_PER_HOUR_LIMITS.min,
          max: CAPACITY_PER_HOUR_LIMITS.max,
        });
      }
    }
  );

  it("equals() は値が同じなら true、違えば false", () => {
    const a = CapacityPerHour.from(5);
    const b = CapacityPerHour.from(5);
    const c = CapacityPerHour.from(6);
    if (!a.ok || !b.ok || !c.ok) throw new Error("fixture broken");
    expect(a.value.equals(b.value)).toBe(true);
    expect(a.value.equals(c.value)).toBe(false);
  });
});
