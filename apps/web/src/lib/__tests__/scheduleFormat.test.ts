import { describe, expect, it } from "vitest";
import { formatScheduleDate, todayInJst } from "../scheduleFormat";

describe("formatScheduleDate", () => {
  it("「年月日（曜日）」にする（月・日の先頭の 0 は付けない）", () => {
    expect(formatScheduleDate("2026-11-03")).toBe("2026年11月3日（火）");
    expect(formatScheduleDate("2027-01-01")).toBe("2027年1月1日（金）");
  });

  it("うるう日も曜日がずれない", () => {
    expect(formatScheduleDate("2028-02-29")).toBe("2028年2月29日（火）");
  });
});

describe("todayInJst", () => {
  it("UTC の 15 時以降は、JST では翌日になる", () => {
    expect(todayInJst(new Date("2026-10-28T15:00:00Z"))).toBe("2026-10-29");
  });

  it("UTC の 15 時より前は、UTC と同じ日", () => {
    expect(todayInJst(new Date("2026-10-28T14:59:59Z"))).toBe("2026-10-28");
  });
});
