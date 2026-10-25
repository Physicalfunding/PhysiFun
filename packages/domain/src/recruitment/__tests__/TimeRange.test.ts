import { describe, expect, it } from "vitest";
import { TimeRange } from "../value-objects/TimeRange";

describe("TimeRange", () => {
  describe("create", () => {
    it("1 時間単位の開始・終了で生成できる", () => {
      const result = TimeRange.create({ start: "10:00", end: "15:00" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.start).toBe("10:00");
        expect(result.value.end).toBe("15:00");
      }
    });

    it("1 時間だけの時間帯（00:00〜01:00）と、最も遅い終了（22:00〜23:00）を受け入れる", () => {
      expect(TimeRange.create({ start: "00:00", end: "01:00" }).ok).toBe(true);
      expect(TimeRange.create({ start: "22:00", end: "23:00" }).ok).toBe(true);
    });

    it.each(["9:00", "09:00:00", "0900", "", "aa:bb", "24:00", "25:00", "10:60"])(
      "形式が違う・存在しない時刻 %j はエラー",
      (value) => {
        const result = TimeRange.create({ start: value, end: "23:00" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toEqual({ type: "INVALID_TIME_FORMAT", field: "start", value });
        }
      }
    );

    it("終了の形式が違うときは field が end になる", () => {
      const result = TimeRange.create({ start: "10:00", end: "24:00" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({ type: "INVALID_TIME_FORMAT", field: "end", value: "24:00" });
      }
    });

    it("分が 00 でない時刻はエラー（1 時間単位）", () => {
      const result = TimeRange.create({ start: "10:30", end: "12:00" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "TIME_NOT_ON_THE_HOUR",
          field: "start",
          value: "10:30",
        });
      }
    });

    it.each([
      ["12:00", "12:00"],
      ["15:00", "10:00"],
    ])("終了が開始より後でない（%s〜%s）とエラー", (start, end) => {
      const result = TimeRange.create({ start, end });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({ type: "END_NOT_AFTER_START", start, end });
      }
    });
  });

  it("equals() は開始・終了が同じなら true、違えば false", () => {
    const a = TimeRange.create({ start: "10:00", end: "12:00" });
    const b = TimeRange.create({ start: "10:00", end: "12:00" });
    const c = TimeRange.create({ start: "10:00", end: "13:00" });
    if (!a.ok || !b.ok || !c.ok) throw new Error("fixture broken");
    expect(a.value.equals(b.value)).toBe(true);
    expect(a.value.equals(c.value)).toBe(false);
  });
});
