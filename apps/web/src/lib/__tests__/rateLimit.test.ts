/**
 * @jest-environment node
 */
import {
  consumeRateLimit,
  enforceRateLimit,
  rateLimitExceededResponse,
  RATE_LIMIT_CONFIGS,
  __resetRateLimitForTests,
} from "../rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  describe("consumeRateLimit", () => {
    describe("createProject (10 req / 10 min)", () => {
      const action = "createProject" as const;
      const config = RATE_LIMIT_CONFIGS[action];

      it("上限ちょうど (10回目) までは ok=true を返す", () => {
        const userId = "user-1";
        const now = 1_000_000;

        for (let i = 0; i < config.limit; i++) {
          const result = consumeRateLimit(action, userId, now + i);
          expect(result.ok).toBe(true);
          expect(result.limit).toBe(config.limit);
          expect(result.remaining).toBe(config.limit - (i + 1));
        }
      });

      it("上限 +1 回目 (11回目) で ok=false を返す", () => {
        const userId = "user-1";
        const now = 1_000_000;

        for (let i = 0; i < config.limit; i++) {
          consumeRateLimit(action, userId, now + i);
        }

        const result = consumeRateLimit(action, userId, now + config.limit);
        expect(result.ok).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      });

      it("ウィンドウ経過後はカウンタがリセットされる", () => {
        const userId = "user-1";
        const now = 1_000_000;

        for (let i = 0; i < config.limit; i++) {
          consumeRateLimit(action, userId, now + i);
        }

        // 超過状態
        expect(consumeRateLimit(action, userId, now + config.limit).ok).toBe(false);

        // 最古のタイムスタンプ (now) からウィンドウ長 + 一定マージンが経過した後は
        // 全タイムスタンプがウィンドウ外になり、カウンタがリセットされる。
        const later = now + config.windowMs + config.limit + 1;
        const result = consumeRateLimit(action, userId, later);
        expect(result.ok).toBe(true);
        expect(result.remaining).toBe(config.limit - 1);
      });

      it("ユーザーごとに独立してカウントされる", () => {
        const now = 1_000_000;

        // user-A を上限まで使い切る
        for (let i = 0; i < config.limit; i++) {
          consumeRateLimit(action, "user-A", now + i);
        }
        expect(consumeRateLimit(action, "user-A", now + config.limit).ok).toBe(false);

        // user-B は影響を受けない
        const result = consumeRateLimit(action, "user-B", now + config.limit);
        expect(result.ok).toBe(true);
        expect(result.remaining).toBe(config.limit - 1);
      });

      it("超過中はカウンタを増やさない (retryAfter が安定する)", () => {
        const userId = "user-1";
        const now = 1_000_000;

        for (let i = 0; i < config.limit; i++) {
          consumeRateLimit(action, userId, now + i);
        }

        const first = consumeRateLimit(action, userId, now + config.limit);
        const second = consumeRateLimit(action, userId, now + config.limit);

        expect(first.ok).toBe(false);
        expect(second.ok).toBe(false);
        // 同一時刻で呼べば retryAfter は等しい
        expect(second.retryAfterSeconds).toBe(first.retryAfterSeconds);
      });
    });

    describe("updateProject (30 req / min)", () => {
      it("30 回は通り、31 回目で弾く", () => {
        const action = "updateProject" as const;
        const userId = "user-1";
        const now = 1_000_000;
        const config = RATE_LIMIT_CONFIGS[action];

        for (let i = 0; i < config.limit; i++) {
          expect(consumeRateLimit(action, userId, now + i).ok).toBe(true);
        }
        expect(consumeRateLimit(action, userId, now + config.limit).ok).toBe(false);
      });
    });

    describe("projectStatusTransition (10 req / min)", () => {
      it("10 回は通り、11 回目で弾く", () => {
        const action = "projectStatusTransition" as const;
        const userId = "user-1";
        const now = 1_000_000;
        const config = RATE_LIMIT_CONFIGS[action];

        for (let i = 0; i < config.limit; i++) {
          expect(consumeRateLimit(action, userId, now + i).ok).toBe(true);
        }
        expect(consumeRateLimit(action, userId, now + config.limit).ok).toBe(false);
      });

      it("アクション間で名前空間が分離されている", () => {
        const userId = "user-1";
        const now = 1_000_000;

        // projectStatusTransition を上限まで使う
        for (let i = 0; i < 10; i++) {
          consumeRateLimit("projectStatusTransition", userId, now + i);
        }
        expect(consumeRateLimit("projectStatusTransition", userId, now + 10).ok).toBe(false);

        // updateProject は影響を受けない
        expect(consumeRateLimit("updateProject", userId, now + 10).ok).toBe(true);
      });
    });
  });

  describe("rateLimitExceededResponse", () => {
    it("429 + Retry-After ヘッダーを返す", async () => {
      const response = rateLimitExceededResponse({
        ok: false,
        limit: 10,
        remaining: 0,
        retryAfterSeconds: 42,
      });

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("42");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");

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

  describe("enforceRateLimit", () => {
    it("制限内なら null を返す", () => {
      const result = enforceRateLimit("createProject", "user-ok");
      expect(result).toBeNull();
    });

    it("超過したら 429 レスポンスを返す", async () => {
      const userId = "user-exceed";
      const config = RATE_LIMIT_CONFIGS.createProject;

      for (let i = 0; i < config.limit; i++) {
        expect(enforceRateLimit("createProject", userId)).toBeNull();
      }

      const response = enforceRateLimit("createProject", userId);
      expect(response).not.toBeNull();
      expect(response?.status).toBe(429);
    });
  });
});
