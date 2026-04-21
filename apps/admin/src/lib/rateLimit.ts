import { LRUCache } from "lru-cache";
import { NextResponse } from "next/server";

/**
 * apps/admin 用レート制限 (#145 / #157 H1)
 *
 * apps/web/src/lib/rateLimit.ts と同構造のインメモリ LRU バケットで、
 * 運営アプリ特有のアクション種別に限定している。
 *
 * - `adminMagicLink`: `/api/auth/signin/email` 用。email を key にして
 *   1 アドレス 15 分間に 5 回まで (Magic Link 送信の濫用防止)。
 * - `adminAction`: `/api/admin/*` 系の運営オペ用。adminAccountId を key にして
 *   1 分間に 60 回まで (運営誤操作 / スクリプト化暴走の抑止)。
 *
 * 水平スケール時は apps/web と同様、Redis 等の中央ストレージに置換する前提。
 */
export type AdminRateLimitAction = "adminMagicLink" | "adminAction";

export interface AdminRateLimitConfig {
  limit: number;
  windowMs: number;
}

export const ADMIN_RATE_LIMIT_CONFIGS: Record<AdminRateLimitAction, AdminRateLimitConfig> = {
  adminMagicLink: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 分
  },
  adminAction: {
    limit: 60,
    windowMs: 60 * 1000, // 1 分
  },
};

interface Bucket {
  timestamps: number[];
}

const MAX_WINDOW_MS = Math.max(...Object.values(ADMIN_RATE_LIMIT_CONFIGS).map((c) => c.windowMs));

const buckets = new LRUCache<string, Bucket>({
  max: 10_000,
  ttl: MAX_WINDOW_MS,
  allowStale: false,
});

function bucketKey(action: AdminRateLimitAction, subject: string): string {
  return `${action}:${subject}`;
}

export interface AdminRateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  reset: number;
}

/**
 * 指定アクション・subject (email / adminAccountId) でリクエストを 1 回消費する。
 * 超過中は timestamp を追加しない (バースト時に TTL が延びて永遠にブロックされるのを回避)。
 */
export function consumeAdminRateLimit(
  action: AdminRateLimitAction,
  subject: string,
  now: number = Date.now()
): AdminRateLimitResult {
  const config = ADMIN_RATE_LIMIT_CONFIGS[action];
  const key = bucketKey(action, subject);
  const bucket = buckets.get(key) ?? { timestamps: [] };

  const windowStart = now - config.windowMs;
  const recent = bucket.timestamps.filter((ts) => ts > windowStart);

  if (recent.length >= config.limit) {
    const oldest = recent[0] ?? now;
    const resetMs = oldest + config.windowMs;
    const retryMs = resetMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryMs / 1000));

    buckets.set(key, { timestamps: recent });

    return {
      ok: false,
      limit: config.limit,
      remaining: 0,
      retryAfterSeconds,
      reset: Math.ceil(resetMs / 1000),
    };
  }

  recent.push(now);
  buckets.set(key, { timestamps: recent });

  const resetMs = now + config.windowMs;
  return {
    ok: true,
    limit: config.limit,
    remaining: config.limit - recent.length,
    retryAfterSeconds: 0,
    reset: Math.ceil(resetMs / 1000),
  };
}

export interface AdminRateLimitErrorBody {
  success: false;
  error: {
    code: "TOO_MANY_REQUESTS";
    message: string;
    retryAfter: number;
  };
}

export function adminRateLimitExceededResponse(result: AdminRateLimitResult): NextResponse {
  const body: AdminRateLimitErrorBody = {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "リクエストが多すぎます。しばらく時間をおいて再度お試しください。",
      retryAfter: result.retryAfterSeconds,
    },
  };
  return NextResponse.json(body, {
    status: 429,
    headers: {
      "Retry-After": String(result.retryAfterSeconds),
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(result.reset),
    },
  });
}

/**
 * /api/admin/* 系の Route Handler 用。429 レスポンスを返すか null を返す。
 */
export function enforceAdminRateLimit(
  action: AdminRateLimitAction,
  subject: string,
  now: number = Date.now()
): NextResponse | null {
  const result = consumeAdminRateLimit(action, subject, now);
  if (!result.ok) {
    return adminRateLimitExceededResponse(result);
  }
  return null;
}

/**
 * Magic Link 送信用。callback で boolean を返すパス (NextAuth signIn callback)
 * 向けに、429 レスポンスではなく ok/NG で判定する。
 *
 * @returns ok=true なら送信を継続、ok=false ならレート超過で中断
 */
export function checkAdminMagicLinkRateLimit(
  email: string,
  now: number = Date.now()
): AdminRateLimitResult {
  return consumeAdminRateLimit("adminMagicLink", email, now);
}

/**
 * テスト用: 全バケットをクリアする。
 * @internal
 */
export function __resetAdminRateLimitForTests(): void {
  buckets.clear();
}
