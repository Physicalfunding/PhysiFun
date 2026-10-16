import { createRateLimiter, type RateLimitResult } from "@physifun/infrastructure";
import { rateLimitExceededResponse } from "@physifun/server-shared";
import type { NextResponse } from "next/server";

export type { RateLimitResult };

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

/**
 * レート制限の本体（#202）。
 *
 * Upstash Redis の接続情報があれば Upstash で全インスタンス共通のカウンタを使い、
 * 無ければプロセス内メモリで数える（ローカル / テスト / CI 向け）。
 * Vercel 本番で接続情報が無い場合はエラー、Upstash 障害時はリクエストを通す（fail-open）。
 * 詳細は `packages/infrastructure/src/rate-limit/createRateLimiter.ts`。
 */
const limiter = createRateLimiter({ prefix: "physifun:web", rules: RATE_LIMIT_CONFIGS });

/**
 * 指定アクション・主体キーでリクエストを 1 回消費し、制限に収まっているか判定する。
 *
 * 破壊的な操作: `ok=true` の場合、カウンタが 1 増える。
 * `ok=false` の場合はカウンタを増やさない (超過中のバーストでウィンドウが延びないように)。
 *
 * @param action アクション種別
 * @param subjectKey 制限の主体を識別するキー。認証済みアクションでは `session.user.id`、
 *   未認証アクション (`leaderApplicationSubmit` など) では IP アドレスを渡す。
 * @param now 現在時刻 (ms)。テスト用 (インメモリ版のみ有効)。省略時は `Date.now()`。
 */
export function consumeRateLimit(
  action: RateLimitAction,
  subjectKey: string,
  now: number = Date.now()
): Promise<RateLimitResult> {
  return limiter.consume(action, subjectKey, now);
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
 * const limited = await enforceRateLimit("createProject", userId);
 * if (limited) return limited;
 */
export async function enforceRateLimit(
  action: RateLimitAction,
  subjectKey: string,
  now: number = Date.now()
): Promise<NextResponse | null> {
  const result = await consumeRateLimit(action, subjectKey, now);
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
  limiter.resetForTests();
}
