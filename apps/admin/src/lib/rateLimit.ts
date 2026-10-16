import { createRateLimiter, type RateLimitResult } from "@physifun/infrastructure";
import { rateLimitExceededResponse } from "@physifun/server-shared";
import type { NextResponse } from "next/server";

/**
 * apps/admin 用レート制限 (#145 / #157 H1)
 *
 * apps/web/src/lib/rateLimit.ts と同じく `@physifun/infrastructure` の `createRateLimiter` を使い、
 * 運営アプリ特有のアクション種別に限定している。
 *
 * - `adminMagicLink`: `/api/auth/signin/email` 用。email を key にして
 *   1 アドレス 15 分間に 5 回まで (Magic Link 送信の濫用防止)。
 * - `adminAction`: `/api/admin/*` 系の運営オペ用。adminAccountId を key にして
 *   1 分間に 60 回まで (運営誤操作 / スクリプト化暴走の抑止)。
 * - `adminRead`: `/api/admin/*` の GET (一覧 / 詳細) 用。adminAccountId を key に
 *   1 分間に 120 回まで。認証済みでの大量スクレイピング抑止 (#166 / PR #165 M-1)。
 *   読み取り用途のため adminAction より少し緩めに設定している。
 *
 * Upstash Redis の接続情報があれば Upstash で全インスタンス共通のカウンタを使い、
 * 無ければプロセス内メモリで数える（ローカル / テスト / CI 向け）。
 * Vercel 本番で接続情報が無い場合はエラー、Upstash 障害時はリクエストを通す（fail-open）（#202）。
 */
export type AdminRateLimitAction = "adminMagicLink" | "adminAction" | "adminRead";

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
  adminRead: {
    limit: 120,
    windowMs: 60 * 1000, // 1 分 (GET 一覧 / 詳細用, #166)
  },
};

const limiter = createRateLimiter({ prefix: "physifun:admin", rules: ADMIN_RATE_LIMIT_CONFIGS });

export type AdminRateLimitResult = RateLimitResult;

/**
 * 指定アクション・subject (email / adminAccountId) でリクエストを 1 回消費する。
 * 超過中はカウンタを増やさない (バースト時にウィンドウが延びて永遠にブロックされるのを回避)。
 *
 * @param now 現在時刻 (ms)。テスト用 (インメモリ版のみ有効)。
 */
export function consumeAdminRateLimit(
  action: AdminRateLimitAction,
  subject: string,
  now: number = Date.now()
): Promise<AdminRateLimitResult> {
  return limiter.consume(action, subject, now);
}

/**
 * /api/admin/* 系の Route Handler 用。429 レスポンスを返すか null を返す。
 */
export async function enforceAdminRateLimit(
  action: AdminRateLimitAction,
  subject: string,
  now: number = Date.now()
): Promise<NextResponse | null> {
  const result = await consumeAdminRateLimit(action, subject, now);
  if (!result.ok) {
    return rateLimitExceededResponse(result);
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
): Promise<AdminRateLimitResult> {
  return consumeAdminRateLimit("adminMagicLink", email, now);
}

/**
 * テスト用: 全バケットをクリアする。
 * @internal
 */
export function __resetAdminRateLimitForTests(): void {
  limiter.resetForTests();
}
