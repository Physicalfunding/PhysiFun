import type {
  CaptchaVerifierPort,
  IpRateLimitPort,
  SubmitLeaderApplicationPort,
} from "@physifun/application";
import { err, ok } from "@physifun/domain";
import { KyselySubmitLeaderApplicationAdapter } from "@physifun/infrastructure";
import { createTurnstileCaptchaVerifier } from "@/lib/captcha";
import { consumeRateLimit } from "@/lib/rateLimit";

/**
 * SubmitLeaderApplicationUseCase 用のポート（Kysely 実装, #222）。
 * アダプタは stateless なので DI 関数ごとに独自インスタンス化する。
 */
export function getSubmitLeaderApplicationPort(): SubmitLeaderApplicationPort {
  return new KyselySubmitLeaderApplicationAdapter();
}

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
    async consume(ipAddress) {
      const result = await consumeRateLimit("leaderApplicationSubmit", ipAddress);
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
