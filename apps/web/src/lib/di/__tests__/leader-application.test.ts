/**
 * @jest-environment node
 */
/**
 * `getLeaderApplicationIpRateLimitPort` の単体テスト (Issue #200)
 *
 * `consumeRateLimit` を呼ぶ薄いアダプタが、レートリミット結果のメタデータを
 * `IpRateLimitExceededError` に正しく載せ替えるかを検証する。
 */
import { getLeaderApplicationIpRateLimitPort } from "../leader-application";
import { __resetRateLimitForTests, RATE_LIMIT_CONFIGS } from "../../rateLimit";

describe("getLeaderApplicationIpRateLimitPort", () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  it("制限内のリクエストは ok を返す", () => {
    const port = getLeaderApplicationIpRateLimitPort();
    const result = port.consume("1.2.3.4");
    expect(result.ok).toBe(true);
  });

  it("制限超過時は RATE_LIMIT_EXCEEDED とメタデータを返す", () => {
    const port = getLeaderApplicationIpRateLimitPort();
    const ip = "5.6.7.8";
    const config = RATE_LIMIT_CONFIGS.leaderApplicationSubmit;

    // 制限ちょうどまで消費
    for (let i = 0; i < config.limit; i++) {
      const ok = port.consume(ip);
      expect(ok.ok).toBe(true);
    }

    // 上限 +1 回目は err
    const result = port.consume(ip);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("RATE_LIMIT_EXCEEDED");
    expect(result.error.limit).toBe(config.limit);
    expect(result.error.remaining).toBe(0);
    // 1 時間ウィンドウなので Retry-After は (0, 3600] の範囲
    expect(result.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.error.retryAfterSeconds).toBeLessThanOrEqual(config.windowMs / 1000);
    expect(result.error.reset).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("異なる IP は独立してカウントされる", () => {
    const port = getLeaderApplicationIpRateLimitPort();
    const config = RATE_LIMIT_CONFIGS.leaderApplicationSubmit;

    for (let i = 0; i < config.limit; i++) {
      port.consume("10.0.0.1");
    }

    // 別 IP は影響を受けない
    const result = port.consume("10.0.0.2");
    expect(result.ok).toBe(true);
  });
});
