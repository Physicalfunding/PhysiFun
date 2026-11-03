import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateUuidV7, isUuid } from "../uuid";

const UUID_V4 = "550e8400-e29b-41d4-a716-446655440000";
const UUID_V7 = "019a4b2e-7c41-7d3a-9f12-3b4c5d6e7f80";

describe("generateUuidV7", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("version が 7、variant が 10（RFC 9562）の UUID を小文字で返す", () => {
    expect(generateUuidV7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it.each([
    ["Unix 時刻の 0", 0],
    ["2026-11-03T12:34:56.789Z", Date.UTC(2026, 10, 3, 12, 34, 56, 789)],
    ["48 bit の最大値", 2 ** 48 - 1],
  ])("先頭 48 bit が、作った時刻（ミリ秒）になる: %s", (_label, now) => {
    vi.setSystemTime(now);

    const id = generateUuidV7();

    const timestampHex = id.replaceAll("-", "").slice(0, 12);
    expect(Number.parseInt(timestampHex, 16)).toBe(now);
  });

  it("時刻を変えて作った値どうしで、文字列の大小が時刻の順になる", () => {
    const base = Date.UTC(2026, 10, 3);
    // 作る順番を時刻の順からずらし、呼び出し順ではなく時刻で並ぶことを確かめる。
    // 1 ミリ秒の差と、16 進の桁の繰り上がり（15 → 16）を含める
    const times = [base + 86_400_000, base + 16, base, base + 15, base + 1];
    const generated = times.map((time) => {
      vi.setSystemTime(time);
      return { time, id: generateUuidV7() };
    });

    const sortedByTime = [...generated].sort((a, b) => a.time - b.time);
    const sortedById = [...generated].sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(sortedById).toEqual(sortedByTime);
  });

  it("同じミリ秒の中でも、呼び出しごとに違う値を返す", () => {
    vi.setSystemTime(Date.UTC(2026, 10, 3));

    expect(generateUuidV7()).not.toBe(generateUuidV7());
  });

  it("作った値は isUuid を通る", () => {
    expect(isUuid(generateUuidV7())).toBe(true);
  });
});

describe("isUuid", () => {
  it.each([
    ["v4", UUID_V4],
    ["v7", UUID_V7],
    ["大文字の v7", UUID_V7.toUpperCase()],
  ])("%s を通す", (_label, value) => {
    expect(isUuid(value)).toBe(true);
  });

  it.each([
    ["v1", "550e8400-e29b-11d4-a716-446655440000"],
    ["v6", "1ec9414c-232a-6b00-b3c8-9e6bdeced846"],
    ["v8", "019a4b2e-7c41-8d3a-9f12-3b4c5d6e7f80"],
    ["variant が 10 でない", "019a4b2e-7c41-7d3a-cf12-3b4c5d6e7f80"],
    ["1 文字足りない", "019a4b2e-7c41-7d3a-9f12-3b4c5d6e7f8"],
    ["1 文字多い", "019a4b2e-7c41-7d3a-9f12-3b4c5d6e7f800"],
    ["ハイフンの位置が違う", "019a4b2e7-c41-7d3a-9f12-3b4c5d6e7f80"],
    ["ハイフンが無い", "019a4b2e7c417d3a9f123b4c5d6e7f80"],
    ["16 進でない文字を含む", "019a4b2e-7c41-7d3a-9f12-3b4c5d6e7f8g"],
    ["前後に空白がある", ` ${UUID_V7} `],
    ["空文字", ""],
  ])("%s は弾く", (_label, value) => {
    expect(isUuid(value)).toBe(false);
  });
});
