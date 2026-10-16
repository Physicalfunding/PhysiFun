import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createRateLimiter, toRateLimitResult } from "../createRateLimiter";

const ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "VERCEL_ENV",
] as const;

const rules = { act: { limit: 2, windowMs: 60_000 } };

describe("createRateLimiter", () => {
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    jest.restoreAllMocks();
  });

  it("接続情報が無ければインメモリで数える", async () => {
    const limiter = createRateLimiter({ prefix: "test", rules });
    const now = 1_000_000;

    expect((await limiter.consume("act", "user-1", now)).ok).toBe(true);
    expect((await limiter.consume("act", "user-1", now + 1)).ok).toBe(true);
    expect((await limiter.consume("act", "user-1", now + 2)).ok).toBe(false);

    limiter.resetForTests();
    expect((await limiter.consume("act", "user-1", now + 3)).ok).toBe(true);
  });

  it("Vercel 本番で接続情報が無ければエラーにする", async () => {
    process.env.VERCEL_ENV = "production";
    const limiter = createRateLimiter({ prefix: "test", rules });

    await expect(limiter.consume("act", "user-1")).rejects.toThrow(
      "Upstash Redis の接続情報が設定されていません"
    );
  });

  it("Vercel 本番以外（preview など）で接続情報が無ければインメモリで数える", async () => {
    process.env.VERCEL_ENV = "preview";
    const limiter = createRateLimiter({ prefix: "test", rules });

    expect((await limiter.consume("act", "user-1")).ok).toBe(true);
  });

  it("Upstash に接続できないときはリクエストを通し、エラーをログに残す（fail-open）", async () => {
    // 接続を拒否されるローカルのポートを指定する（外部ネットワークには出ない）
    process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:9";
    process.env.UPSTASH_REDIS_REST_TOKEN = "dummy-token";
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const limiter = createRateLimiter({ prefix: "test", rules });
    const now = Date.now();

    const result = await limiter.consume("act", "user-1", now);

    expect(result.ok).toBe(true);
    expect(result.limit).toBe(2);
    expect(result.retryAfterSeconds).toBe(0);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("KV_REST_API_URL / KV_REST_API_TOKEN（Vercel Marketplace 連携の変数名）も接続情報として使う", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.KV_REST_API_URL = "http://127.0.0.1:9";
    process.env.KV_REST_API_TOKEN = "dummy-token";
    jest.spyOn(console, "error").mockImplementation(() => {});
    const limiter = createRateLimiter({ prefix: "test", rules });

    // 接続情報があるので本番でもエラーにならず、Upstash 経由（ここでは接続失敗で fail-open）になる
    expect((await limiter.consume("act", "user-1")).ok).toBe(true);
  });
});

describe("toRateLimitResult", () => {
  it("通過時は残り回数とリセット時刻（秒）を返す", () => {
    expect(
      toRateLimitResult({ success: true, limit: 10, remaining: 7, reset: 1_700_000_000_500 }, 0)
    ).toEqual({ ok: true, limit: 10, remaining: 7, retryAfterSeconds: 0, reset: 1_700_000_001 });
  });

  it("超過時は Retry-After（秒、切り上げ・最低 1）を返す", () => {
    const now = 1_700_000_000_000;
    expect(
      toRateLimitResult({ success: false, limit: 10, remaining: 0, reset: now + 41_200 }, now)
    ).toEqual({ ok: false, limit: 10, remaining: 0, retryAfterSeconds: 42, reset: 1_700_000_042 });
    expect(
      toRateLimitResult({ success: false, limit: 10, remaining: 0, reset: now }, now)
        .retryAfterSeconds
    ).toBe(1);
  });
});
