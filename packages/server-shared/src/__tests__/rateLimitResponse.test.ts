import { describe, expect, it } from "vitest";
import { rateLimitExceededResponse } from "../rateLimitResponse";

describe("rateLimitExceededResponse", () => {
  it("429 + Retry-After / X-RateLimit-* ヘッダーとエラーボディを返す", async () => {
    const response = rateLimitExceededResponse({
      limit: 10,
      remaining: 0,
      retryAfterSeconds: 42,
      reset: 1_700_000_042,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBe("1700000042");

    const body = await response.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: "TOO_MANY_REQUESTS",
        message: expect.any(String),
        retryAfter: 42,
      },
    });
  });
});
