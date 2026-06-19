import type { CaptchaVerifierPort, IpRateLimitPort } from "@physifun/application";
import { err, ok } from "@physifun/domain";
import { createTurnstileCaptchaVerifier } from "@/lib/captcha";
import { consumeRateLimit } from "@/lib/rateLimit";

// NOTE: SubmitLeaderApplicationPort（Kysely 実装）の DI は ESM/Jest 隔離のため
// `leader-application-submit.ts` に分離している。このファイルは IP レートリミットポートの
// Jest テストから import されるため、Kysely を読み込む実装を持ち込まない。

/**
 * CAPTCHA 検証ポート（Cloudflare Turnstile 実装）。
 */
export function getCaptchaVerifierPort(): CaptchaVerifierPort {
  return createTurnstileCaptchaVerifier();
}

/**
 * 応募 API 用 IP レートリミットポート (Issue #200 / B-6)。
 *
 * `apps/web/src/lib/rateLimit.ts` の `consumeRateLimit` を `IpRateLimitPort`
 * インターフェース（`Result<void, RATE_LIMIT_EXCEEDED>`）に適合させる薄い
 * アダプタ。リミット種別は `leaderApplicationSubmit` 固定。
 */
export function getLeaderApplicationIpRateLimitPort(): IpRateLimitPort {
  return {
    consume(ipAddress) {
      const result = consumeRateLimit("leaderApplicationSubmit", ipAddress);
      if (!result.ok) {
        return err({
          type: "RATE_LIMIT_EXCEEDED",
          limit: result.limit,
          remaining: result.remaining,
          retryAfterSeconds: result.retryAfterSeconds,
          reset: result.reset,
        });
      }
      return ok(undefined);
    },
  };
}
