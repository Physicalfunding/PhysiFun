import { LRUCache } from "lru-cache";
import type { RateLimitResult, RateLimitRule } from "./createRateLimiter";

interface Bucket {
  /** 現在のウィンドウ内に記録されたリクエストのタイムスタンプ (ms) */
  timestamps: number[];
}

/**
 * プロセス内メモリ（LRU）で数えるスライディングウィンドウ（タイムスタンプの記録方式）のレート制限。
 *
 * 単一プロセスのメモリに載るため、Vercel のように複数インスタンスで動く環境ではカウンタが共有されない。
 * Upstash Redis の接続情報が無いとき（ローカル / テスト / CI）のフォールバックとして使う（#202）。
 *
 * - key は `<action>:<subject>` 形式。max 件数に達すると LRU で古い主体から捨てる
 * - ttl は最長ウィンドウに揃え、放置された bucket が自動で消えるようにしている
 */
export function createMemoryRateLimiter<A extends string>(rules: Record<A, RateLimitRule>) {
  const maxWindowMs = Math.max(...Object.values<RateLimitRule>(rules).map((r) => r.windowMs));
  const buckets = new LRUCache<string, Bucket>({
    max: 10_000,
    ttl: maxWindowMs,
    // 期限切れデータは返さない (古いカウンタでリクエストを弾かないため)。
    allowStale: false,
  });

  /**
   * 1 回分を消費して判定する。
   * 超過中はタイムスタンプを追加しない (バースト時に TTL が延びて永遠にブロックされるのを避ける)。
   */
  function consume(action: A, subject: string, now: number): RateLimitResult {
    const rule = rules[action];
    const key = `${action}:${subject}`;
    const bucket = buckets.get(key) ?? { timestamps: [] };

    // ウィンドウ外の古いタイムスタンプは除去
    const windowStart = now - rule.windowMs;
    const recent = bucket.timestamps.filter((ts) => ts > windowStart);

    if (recent.length >= rule.limit) {
      // 超過: 最古のタイムスタンプが期限切れになるまでの秒数を返す
      const oldest = recent[0] ?? now;
      const resetMs = oldest + rule.windowMs;
      buckets.set(key, { timestamps: recent });
      return {
        ok: false,
        limit: rule.limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((resetMs - now) / 1000)),
        reset: Math.ceil(resetMs / 1000),
      };
    }

    recent.push(now);
    buckets.set(key, { timestamps: recent });

    // 今回記録したタイムスタンプがウィンドウから外れる時刻 = reset
    return {
      ok: true,
      limit: rule.limit,
      remaining: rule.limit - recent.length,
      retryAfterSeconds: 0,
      reset: Math.ceil((now + rule.windowMs) / 1000),
    };
  }

  return { consume, clear: () => buckets.clear() };
}
