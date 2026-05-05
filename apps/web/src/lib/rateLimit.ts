import { LRUCache } from "lru-cache";
import { NextResponse } from "next/server";

/**
 * レート制限のアクション種別。
 *
 * - `createProject`: `POST /api/my/projects` 用 (10 req / 10 min / user)
 * - `updateProject`: `PATCH /api/my/projects/[projectId]` 用 (30 req / min / user)
 * - `projectStatusTransition`: 公開申請 / 取下げ / 非公開化 用 (10 req / min / user)
 * - `leaderApplicationSubmit`: `POST /api/leader-applications` 用 (3 req / 1 hour / IP)
 *   未認証の公開エンドポイントなので key は IP アドレス（Issue #200 / B-6）。
 *
 * NOTE (Issue #108): `projectStatusTransition` は Issue #108 原文の
 * 「Status transitions: 10 req / min / user」に従い、
 * **`request-publish` / `withdraw` / `unpublish` の 3 ルート合算で 10 req/min/user** を消費する。
 * ルートごとに独立したカウンタを持たせず、同じ `projectStatusTransition` キーで
 * スライディングウィンドウを共有しているのは意図的な設計。
 */
export type RateLimitAction =
  | "createProject"
  | "updateProject"
  | "projectStatusTransition"
  | "leaderApplicationSubmit";

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
 *
 * NOTE: `projectStatusTransition` は `request-publish` / `withdraw` / `unpublish` の
 * 3 ルート合算で 10 req/min/user を消費する (Issue #108 原文「Status transitions: 10 req / min / user」に準拠)。
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
    windowMs: 60 * 1000, // 1 分 (request-publish / withdraw / unpublish 合算)
  },
  leaderApplicationSubmit: {
    limit: 3,
    windowMs: 60 * 60 * 1000, // 1 時間 (Issue #200 / B-6, 同一 IP からの連続応募抑止)
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
 * `LEADER_APPLICATION_ENABLED=true` で本番トラフィックを受ける前に
 * Vercel KV へ移行することがブロッカー。トラッキング Issue:
 * https://github.com/Physicalfunding/PhysiFun/issues/202
 *
 * key は `<action>:<userId>` 形式。
 * max 件数に到達すると LRU で古いユーザーから捨てる。
 * ttl は最長ウィンドウに揃えて、放置された bucket が自動で消えるようにしている
 * (`RATE_LIMIT_CONFIGS` から導出してマジックナンバーを避ける)。
 */
const MAX_WINDOW_MS = Math.max(...Object.values(RATE_LIMIT_CONFIGS).map((c) => c.windowMs));

const buckets = new LRUCache<string, Bucket>({
  max: 10_000,
  ttl: MAX_WINDOW_MS,
  // 期限切れデータは返さない (古いカウンタでリクエストを弾かないため)。
  allowStale: false,
});

function bucketKey(action: RateLimitAction, subjectKey: string): string {
  return `${action}:${subjectKey}`;
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
  /**
   * 現在のウィンドウがリセットされる UNIX エポック秒 (整数)。
   *
   * - `ok=false` の場合: 最古のタイムスタンプがウィンドウから外れる時刻。
   * - `ok=true` の場合: 今回記録したタイムスタンプがウィンドウから外れる時刻。
   *
   * `X-RateLimit-Reset` ヘッダーに使う。
   */
  reset: number;
}

/**
 * 指定アクション・主体キーでリクエストを 1 回消費し、制限に収まっているか判定する。
 *
 * 破壊的な操作: `ok=true` の場合、内部のカウンタにタイムスタンプが追加される。
 * `ok=false` の場合はカウンタを増やさない (超過中のバーストで TTL が延びないように)。
 *
 * @param action アクション種別
 * @param subjectKey 制限の主体を識別するキー。認証済みアクションでは `session.user.id`、
 *   未認証アクション (`leaderApplicationSubmit` など) では IP アドレスを渡す。
 * @param now 現在時刻 (ms)。テスト用に差し替え可能。省略時は `Date.now()`。
 */
export function consumeRateLimit(
  action: RateLimitAction,
  subjectKey: string,
  now: number = Date.now()
): RateLimitResult {
  const config = RATE_LIMIT_CONFIGS[action];
  const key = bucketKey(action, subjectKey);
  const bucket = buckets.get(key) ?? { timestamps: [] };

  // ウィンドウ外の古いタイムスタンプは除去
  const windowStart = now - config.windowMs;
  const recent = bucket.timestamps.filter((ts) => ts > windowStart);

  if (recent.length >= config.limit) {
    // 超過: 最古のタイムスタンプが期限切れになるまでの秒数を返す
    const oldest = recent[0] ?? now;
    const resetMs = oldest + config.windowMs;
    const retryMs = resetMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryMs / 1000));

    // bucket 側も掃除済みの配列で上書きしておく
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

  // 今回記録したタイムスタンプがウィンドウから外れる時刻 = reset
  const resetMs = now + config.windowMs;

  return {
    ok: true,
    limit: config.limit,
    remaining: config.limit - recent.length,
    retryAfterSeconds: 0,
    reset: Math.ceil(resetMs / 1000),
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
      "X-RateLimit-Reset": String(result.reset),
    },
  });
}

/**
 * API Route Handler 用の薄いラッパー。
 * 主体が制限を超えていたら 429 レスポンスを返し、そうでなければ null を返す。
 *
 * @param action アクション種別
 * @param subjectKey 制限の主体を識別するキー (認証済みなら user.id、未認証なら IP)
 * @param now 現在時刻 (ms)。テスト用に差し替え可能。省略時は `Date.now()`。
 *
 * @example
 * const limited = enforceRateLimit("createProject", userId);
 * if (limited) return limited;
 */
export function enforceRateLimit(
  action: RateLimitAction,
  subjectKey: string,
  now: number = Date.now()
): NextResponse | null {
  const result = consumeRateLimit(action, subjectKey, now);
  if (!result.ok) {
    return rateLimitExceededResponse(result);
  }
  return null;
}

/**
 * テスト用: 全バケットをクリアする。
 *
 * @internal Jest テスト専用。プロダクションコードから呼ばないこと。
 */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}
