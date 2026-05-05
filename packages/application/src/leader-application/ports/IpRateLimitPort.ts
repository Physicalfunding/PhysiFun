import type { Result } from "@physifun/domain";

/**
 * IP レートリミットポート (Issue #200 / B-6)
 *
 * リーダー応募 API は未認証の公開エンドポイントなので、IP アドレス単位で
 * リクエスト数を制限する。実装は apps/web の lru-cache ベースのインメモリ
 * バケット（apps/web/src/lib/rateLimit.ts）を呼び出す。
 *
 * `consume` という命名は「呼ぶたびに 1 回分のクォータを消費する」副作用を
 * 持つことを明示するため。
 */
export interface IpRateLimitPort {
  consume(ipAddress: string): Result<void, { type: "RATE_LIMIT_EXCEEDED" }>;
}
