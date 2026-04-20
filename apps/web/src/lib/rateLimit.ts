import { LRUCache } from "lru-cache";
import { NextResponse } from "next/server";

/**
 * レート制限のアクション種別。
 *
 * - `createProject`: `POST /api/my/projects` 用 (10 req / 10 min / user)
 * - `updateProject`: `PATCH /api/my/projects/[projectId]` 用 (30 req / min / user)
 * - `projectStatusTransition`: 公開申請 / 取下げ / 非公開化 用 (10 req / min / user)
 */
export type RateLimitAction = "createProject" | "updateProject" | "projectStatusTransition";

/**
 * レート制限の設定 (上限回数とウィンドウ長)。
 */
export interface RateLimitConfig {
  /** ウィンドウ内に許可する最大リクエスト数 */
  limit: number;
  /** ウィンドウ長 (ミリ秒) */
  windowMs: number;
}

/**
 * アクションごとのレート制限設定。
 * Issue #108 の要件に合わせている。
 */
export const RATE_LIMIT_CONFIGS: Record<RateLimitAction, RateLimitConfig> = {
  createProject: {
    limit: 10,
    windowMs: 10 * 60 * 1000, // 10 分
  },
  updateProject: {
    limit: 30,
    windowMs: 60 * 1000, // 1 分
  },
  projectStatusTransition: {
    limit: 10,
    windowMs: 60 * 1000, // 1 分
  },
};

interface Bucket {
  /** 現在のウィンドウ内に記録されたリクエストのタイムスタンプ (ms) */
  timestamps: number[];
}

/**
 * LRU ベースのインメモリバケット。
 *
 * NOTE: これは単一プロセス内のメモリに載るキャッシュなので、
 * **水平スケール環境 (複数 Vercel インスタンスなど) では各インスタンスごとに
 * 独立したカウンタを持つ**。完全な集中管理には Vercel KV / Upstash Redis 等の
 * 外部ストレージが必要。Phase 1 の暫定対策として十分なので、スケール時に
 * 置き換える前提で使う。
 *
 * key は `<action>:<userId>` 形式。
 * max 件数に到達すると LRU で古いユーザーから捨てる。
 * ttl はウィンドウ長と揃えて、放置された bucket が自動で消えるようにしている。
 */
const buckets = new LRUCache<string, Bucket>({
  max: 10_000,
  // 一番長いウィンドウ (createProject の 10 分) に合わせておけば
  // 短いウィンドウの bucket が先に自然消滅してくれる。
  ttl: 10 * 60 * 1000,
});

function bucketKey(action: RateLimitAction, userId: string): string {
  return `${action}:${userId}`;
}

/**
 * レート制限チェック結果。
 */
export interface RateLimitResult {
  /** リクエストを通してよいかどうか */
  ok: boolean;
  /** ウィンドウ内で許可される最大リクエスト数 */
  limit: number;
  /** 現在のウィンドウ内での残り可能回数 (ok=false の場合は 0) */
  remaining: number;
  /**
   * クライアントが再試行可能になるまでの秒数 (整数, 最低 1)。
   * ok=true の場合は 0 が入る。
   */
  retryAfterSeconds: number;
}

/**
 * 指定アクション・ユーザーでリクエストを 1 回消費し、制限に収まっているか判定する。
 *
 * 破壊的な操作: `ok=true` の場合、内部のカウンタにタイムスタンプが追加される。
 * `ok=false` の場合はカウンタを増やさない (超過中のバーストで TTL が延びないように)。
 *
 * @param action アクション種別
 * @param userId ユーザー ID (`session.user.id`)
 * @param now 現在時刻 (ms)。テスト用に差し替え可能。省略時は `Date.now()`。
 */
export function consumeRateLimit(
  action: RateLimitAction,
  userId: string,
  now: number = Date.now()
): RateLimitResult {
  const config = RATE_LIMIT_CONFIGS[action];
  const key = bucketKey(action, userId);
  const bucket = buckets.get(key) ?? { timestamps: [] };

  // ウィンドウ外の古いタイムスタンプは除去
  const windowStart = now - config.windowMs;
  const recent = bucket.timestamps.filter((ts) => ts > windowStart);

  if (recent.length >= config.limit) {
    // 超過: 最古のタイムスタンプが期限切れになるまでの秒数を返す
    const oldest = recent[0] ?? now;
    const retryMs = oldest + config.windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryMs / 1000));

    // bucket 側も掃除済みの配列で上書きしておく
    buckets.set(key, { timestamps: recent });

    return {
      ok: false,
      limit: config.limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  recent.push(now);
  buckets.set(key, { timestamps: recent });

  return {
    ok: true,
    limit: config.limit,
    remaining: config.limit - recent.length,
    retryAfterSeconds: 0,
  };
}

/**
 * 429 レスポンスボディ。
 */
export interface RateLimitErrorBody {
  success: false;
  error: {
    code: "TOO_MANY_REQUESTS";
    message: string;
    retryAfter: number;
  };
}

/**
 * レート制限超過時の 429 レスポンスを生成する。
 * `Retry-After` ヘッダーと JSON ボディ両方に秒数を入れる。
 */
export function rateLimitExceededResponse(result: RateLimitResult): NextResponse {
  const body: RateLimitErrorBody = {
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
    },
  });
}

/**
 * API Route Handler 用の薄いラッパー。
 * ユーザーが制限を超えていたら 429 レスポンスを返し、そうでなければ null を返す。
 *
 * @example
 * const limited = enforceRateLimit("createProject", userId);
 * if (limited) return limited;
 */
export function enforceRateLimit(action: RateLimitAction, userId: string): NextResponse | null {
  const result = consumeRateLimit(action, userId);
  if (!result.ok) {
    return rateLimitExceededResponse(result);
  }
  return null;
}

/**
 * テスト用: 全バケットをクリアする。
 * 本番コードからは呼ばないこと。
 */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}
