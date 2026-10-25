import { describe, expect, it } from "vitest";
import { ScheduleDate } from "../value-objects/ScheduleDate";

describe("ScheduleDate", () => {
  it("YYYY-MM-DD の文字列で生成でき、そのまま返す", () => {
    const result = ScheduleDate.from("2026-11-03");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toString()).toBe("2026-11-03");
    }
  });

  it("うるう年の 2 月 29 日を受け入れる", () => {
    expect(ScheduleDate.from("2028-02-29").ok).toBe(true);
  });

  it.each(["2026/11/03", "2026-1-3", "20261103", "", "2026-11-03T00:00:00Z"])(
    "形式が違う %j はエラー",
    (value) => {
      const result = ScheduleDate.from(value);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({ type: "INVALID_SCHEDULE_DATE", value });
      }
    }
  );

  it.each(["2026-02-30", "2027-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "2026-01-00"])(
    "存在しない日付 %j はエラー",
    (value) => {
      const result = ScheduleDate.from(value);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("INVALID_SCHEDULE_DATE");
      }
    }
  );

  it("equals() は日付が同じなら true、違えば false", () => {
    const a = ScheduleDate.from("2026-11-03");
    const b = ScheduleDate.from("2026-11-03");
    const c = ScheduleDate.from("2026-11-04");
    if (!a.ok || !b.ok || !c.ok) throw new Error("fixture broken");
    expect(a.value.equals(b.value)).toBe(true);
    expect(a.value.equals(c.value)).toBe(false);
  });
});
