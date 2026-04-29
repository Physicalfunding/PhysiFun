/**
 * apps/admin レート制限の単体テスト (#166 / PR #177 レビュー対応)
 *
 * apps/web/src/lib/__tests__/rateLimit.test.ts と同構造で、
 * admin 特有のアクション (`adminRead` / `adminAction`) の動作を検証する。
 *
 * 実行: `bun test apps/admin/src/lib/__tests__/rateLimit.test.ts`
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  consumeAdminRateLimit,
  enforceAdminRateLimit,
  adminRateLimitExceededResponse,
  ADMIN_RATE_LIMIT_CONFIGS,
  __resetAdminRateLimitForTests,
} from "../rateLimit";

describe("adminRateLimit", () => {
  beforeEach(() => {
    __resetAdminRateLimitForTests();
  });

  describe("consumeAdminRateLimit", () => {
    describe("adminRead (120 req / min)", () => {
      const action = "adminRead" as const;
      const config = ADMIN_RATE_LIMIT_CONFIGS[action];

      test("上限ちょうど (120回目) までは ok=true を返す", () => {
        const subject = "admin-1";
        const now = 1_000_000;

        for (let i = 0; i < config.limit; i++) {
          const result = consumeAdminRateLimit(action, subject, now + i);
          expect(result.ok).toBe(true);
          expect(result.limit).toBe(config.limit);
          expect(result.remaining).toBe(config.limit - (i + 1));
          // 今回のタイムスタンプがウィンドウから外れる時刻 (秒)
          expect(result.reset).toBe(Math.ceil((now + i + config.windowMs) / 1000));
        }
      });

      test("上限 +1 回目 (121回目) で ok=false を返す", () => {
        const subject = "admin-1";
        const now = 1_000_000;

        for (let i = 0; i < config.limit; i++) {
          consumeAdminRateLimit(action, subject, now + i);
        }

        const result = consumeAdminRateLimit(action, subject, now + config.limit);
        expect(result.ok).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
        // 最古のタイムスタンプ (= now) がウィンドウから外れる時刻 (秒)
        expect(result.reset).toBe(Math.ceil((now + config.windowMs) / 1000));
      });

      test("ウィンドウ経過後はカウンタがリセットされる", () => {
        const subject = "admin-1";
        const now = 1_000_000;

        for (let i = 0; i < config.limit; i++) {
          consumeAdminRateLimit(action, subject, now + i);
        }

        // 超過状態
        expect(consumeAdminRateLimit(action, subject, now + config.limit).ok).toBe(false);

        // 最古のタイムスタンプ (now) からウィンドウ長 + 一定マージンが経過した後は
        // 全タイムスタンプがウィンドウ外になり、カウンタがリセットされる。
        const later = now + config.windowMs + config.limit + 1;
        const result = consumeAdminRateLimit(action, subject, later);
        expect(result.ok).toBe(true);
        expect(result.remaining).toBe(config.limit - 1);
      });

      test("超過中はカウンタを増やさない (retryAfter が安定する)", () => {
        const subject = "admin-1";
        const now = 1_000_000;

        for (let i = 0; i < config.limit; i++) {
          consumeAdminRateLimit(action, subject, now + i);
        }

        const first = consumeAdminRateLimit(action, subject, now + config.limit);
        const second = consumeAdminRateLimit(action, subject, now + config.limit);

        expect(first.ok).toBe(false);
        expect(second.ok).toBe(false);
        // 同一時刻で呼べば retryAfter は等しい
        expect(second.retryAfterSeconds).toBe(first.retryAfterSeconds);
      });
    });

    describe("adminAction (60 req / min)", () => {
      test("60 回は通り、61 回目で弾く", () => {
        const action = "adminAction" as const;
        const subject = "admin-1";
        const now = 1_000_000;
        const config = ADMIN_RATE_LIMIT_CONFIGS[action];

        for (let i = 0; i < config.limit; i++) {
          expect(consumeAdminRateLimit(action, subject, now + i).ok).toBe(true);
        }
        expect(consumeAdminRateLimit(action, subject, now + config.limit).ok).toBe(false);
      });
    });

    describe("adminRead と adminAction の独立性", () => {
      test("adminAction と adminRead が独立してカウントされる", () => {
        const subject = "admin-1";
        const now = 1_000_000;
        const actionConfig = ADMIN_RATE_LIMIT_CONFIGS.adminAction;

        // adminAction を上限まで使い切る (60回)
        for (let i = 0; i < actionConfig.limit; i++) {
          consumeAdminRateLimit("adminAction", subject, now + i);
        }
        expect(consumeAdminRateLimit("adminAction", subject, now + actionConfig.limit).ok).toBe(
          false
        );

        // adminRead は影響を受けない (別のバケット)
        const result = consumeAdminRateLimit("adminRead", subject, now + actionConfig.limit);
        expect(result.ok).toBe(true);
        expect(result.remaining).toBe(ADMIN_RATE_LIMIT_CONFIGS.adminRead.limit - 1);
      });
    });
  });

  describe("adminRateLimitExceededResponse", () => {
    test("429 + Retry-After / X-RateLimit-* ヘッダーを正確な値で返す", async () => {
      const response = adminRateLimitExceededResponse({
        ok: false,
        limit: 120,
        remaining: 0,
        retryAfterSeconds: 42,
        reset: 1_700_000_042,
      });

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("42");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("120");
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

  describe("enforceAdminRateLimit", () => {
    test("制限内なら null を返す", () => {
      const result = enforceAdminRateLimit("adminRead", "admin-ok");
      expect(result).toBeNull();
    });

    test("adminRead: 超過したら 429 レスポンスを返す", async () => {
      const subject = "admin-exceed-read";
      const config = ADMIN_RATE_LIMIT_CONFIGS.adminRead;

      for (let i = 0; i < config.limit; i++) {
        expect(enforceAdminRateLimit("adminRead", subject)).toBeNull();
      }

      const response = enforceAdminRateLimit("adminRead", subject);
      expect(response).not.toBeNull();
      expect(response?.status).toBe(429);
    });

    test("now を渡してテスト内で時間を固定できる", async () => {
      const subject = "admin-fixed-now";
      const action = "adminRead" as const;
      const config = ADMIN_RATE_LIMIT_CONFIGS[action];
      const now = 1_700_000_000_000;

      for (let i = 0; i < config.limit; i++) {
        expect(enforceAdminRateLimit(action, subject, now + i)).toBeNull();
      }

      const response = enforceAdminRateLimit(action, subject, now + config.limit);
      expect(response).not.toBeNull();
      expect(response?.status).toBe(429);
      // X-RateLimit-Reset は最古のタイムスタンプがウィンドウから外れる時刻 (秒)
      expect(response?.headers.get("X-RateLimit-Reset")).toBe(
        String(Math.ceil((now + config.windowMs) / 1000))
      );
    });

    test("成功レスポンス相当: 制限内で Retry-After / X-RateLimit-* ヘッダー値を consumeAdminRateLimit で確認できる", () => {
      const subject = "admin-header-check";
      const action = "adminRead" as const;
      const config = ADMIN_RATE_LIMIT_CONFIGS[action];
      const now = 1_700_000_000_000;

      // 1回消費して remaining と reset を確認
      const result = consumeAdminRateLimit(action, subject, now);
      expect(result.ok).toBe(true);
      expect(result.limit).toBe(config.limit);
      expect(result.remaining).toBe(config.limit - 1);
      expect(result.reset).toBe(Math.ceil((now + config.windowMs) / 1000));
      expect(result.retryAfterSeconds).toBe(0);
    });
  });
});
