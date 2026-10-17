import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyCronRequest } from "../cronAuth";

function requestWith(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("https://example.com/api/cron/test", { headers });
}

describe("verifyCronRequest", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
    vi.restoreAllMocks();
  });

  it("正しい Bearer なら null を返す（処理を続けてよい）", () => {
    expect(verifyCronRequest(requestWith("Bearer test-secret"))).toBeNull();
  });

  it("Authorization ヘッダーが無ければ 401", () => {
    expect(verifyCronRequest(requestWith())?.status).toBe(401);
  });

  it("Bearer が不一致なら 401（同じ長さ / 違う長さのどちらも）", () => {
    expect(verifyCronRequest(requestWith("Bearer test-secreX"))?.status).toBe(401);
    expect(verifyCronRequest(requestWith("Bearer wrong"))?.status).toBe(401);
    expect(verifyCronRequest(requestWith("test-secret"))?.status).toBe(401);
  });

  it("CRON_SECRET 未設定なら 500（`Bearer undefined` でも通さない）", () => {
    delete process.env.CRON_SECRET;
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(verifyCronRequest(requestWith("Bearer undefined"))?.status).toBe(500);
    expect(verifyCronRequest(requestWith())?.status).toBe(500);
  });
});
