import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createMemoryRateLimiter } from "./memoryRateLimiter";

/** レート制限のルール（ウィンドウ内の上限回数とウィンドウ長） */
export interface RateLimitRule {
  /** ウィンドウ内に許可する最大リクエスト数 */
  limit: number;
  /** ウィンドウ長 (ミリ秒) */
  windowMs: number;
}

/** レート制限の判定結果（429 レスポンスの `Retry-After` / `X-RateLimit-*` に使う値を含む） */
export interface RateLimitResult {
  /** リクエストを通してよいかどうか */
  ok: boolean;
  /** ウィンドウ内で許可される最大リクエスト数 */
  limit: number;
  /** 現在のウィンドウ内での残り可能回数 (ok=false の場合は 0) */
  remaining: number;
  /** クライアントが再試行可能になるまでの秒数 (整数, 最低 1)。ok=true の場合は 0 */
  retryAfterSeconds: number;
  /** カウンタがリセットされる UNIX エポック秒 (整数)。`X-RateLimit-Reset` に使う */
  reset: number;
}

export interface RateLimiter<A extends string> {
  /**
   * 指定アクション・主体で 1 回分を消費し、制限に収まっているか判定する。
   *
   * @param subject 制限の主体（認証済みならアカウント ID、未認証なら IP アドレスなど）
   * @param now 現在時刻 (ms)。インメモリ版のテスト用で、Upstash 版では使わない
   */
  consume(action: A, subject: string, now?: number): Promise<RateLimitResult>;
  /** テスト用: インメモリ版のカウンタを空にする（Upstash 版では何もしない） */
  resetForTests(): void;
}

/** Upstash への問い合わせを待つ上限 (ms)。超えたらリクエストを通す（fail-open） */
const UPSTASH_TIMEOUT_MS = 1000;

/**
 * レート制限を作る（#202）。
 *
 * - Upstash Redis の接続情報があれば Upstash を使い、全インスタンスでカウンタを共有する
 * - 無ければプロセス内メモリで数える（ローカル / テスト / CI 向け）
 * - Vercel の本番（`VERCEL_ENV=production`）で接続情報が無い場合は、設定漏れとしてエラーにする
 * - Upstash に問い合わせられないとき（障害・タイムアウト）はリクエストを通し、エラーをログに残す（fail-open）
 *
 * 接続情報は `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`、
 * または Vercel Marketplace 連携が設定する `KV_REST_API_URL` / `KV_REST_API_TOKEN` から読む。
 * どちらを使うかは最初の `consume` で決める（ビルド時に環境変数を要求しないため）。
 *
 * NOTE: Upstash の slidingWindow は、直前のウィンドウの件数を経過割合で重み付けする近似のスライディングウィンドウ。
 * インメモリ版（全タイムスタンプを記録する方式）とは境界付近の挙動が少し異なる。
 *
 * @param prefix Redis のキー接頭辞（アプリごとに分ける。例: `physifun:web`）
 * @param rules アクションごとのルール
 */
export function createRateLimiter<A extends string>(params: {
  prefix: string;
  rules: Record<A, RateLimitRule>;
}): RateLimiter<A> {
  const { prefix, rules } = params;
  const memory = createMemoryRateLimiter(rules);
  let upstash: Record<A, Ratelimit> | null | undefined;

  function resolveUpstash(): Record<A, Ratelimit> | null {
    if (upstash !== undefined) return upstash;

    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      if (process.env.VERCEL_ENV === "production") {
        throw new Error(
          "[rateLimit] Upstash Redis の接続情報が設定されていません（UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN、または KV_REST_API_URL / KV_REST_API_TOKEN）"
        );
      }
      upstash = null;
      return upstash;
    }

    const redis = new Redis({ url, token });
    const limiters = {} as Record<A, Ratelimit>;
    for (const action of Object.keys(rules) as A[]) {
      const rule = rules[action];
      limiters[action] = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowMs} ms`),
        prefix: `${prefix}:${action}`,
        timeout: UPSTASH_TIMEOUT_MS,
        analytics: false,
      });
    }
    upstash = limiters;
    return upstash;
  }

  return {
    async consume(action, subject, now = Date.now()) {
      const limiters = resolveUpstash();
      if (!limiters) return memory.consume(action, subject, now);

      const rule = rules[action];
      // fail-open 時の結果（カウンタが分からないので、残り回数は上限のまま返す）
      const passThrough: RateLimitResult = {
        ok: true,
        limit: rule.limit,
        remaining: rule.limit,
        retryAfterSeconds: 0,
        reset: Math.ceil((now + rule.windowMs) / 1000),
      };
      try {
        const response = await limiters[action].limit(subject);
        // タイムアウト時は @upstash/ratelimit が success=true（limit / reset は 0）で返すため、ここで置き換える
        if (response.reason === "timeout") {
          console.error(
            `[rateLimit] Upstash が時間内に応答しなかったため通過させます (action=${action})`
          );
          return passThrough;
        }
        return toRateLimitResult(response, Date.now());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[rateLimit] Upstash への問い合わせに失敗したため通過させます (action=${action}):`,
          message
        );
        return passThrough;
      }
    },
    resetForTests() {
      memory.clear();
    },
  };
}

/** `@upstash/ratelimit` の判定（`reset` はミリ秒）を `RateLimitResult` に変換する */
export function toRateLimitResult(
  response: { success: boolean; limit: number; remaining: number; reset: number },
  now: number
): RateLimitResult {
  const reset = Math.ceil(response.reset / 1000);
  if (response.success) {
    return {
      ok: true,
      limit: response.limit,
      remaining: response.remaining,
      retryAfterSeconds: 0,
      reset,
    };
  }
  return {
    ok: false,
    limit: response.limit,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil((response.reset - now) / 1000)),
    reset,
  };
}
