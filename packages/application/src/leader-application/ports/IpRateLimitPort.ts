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
 *
 * エラー時は 429 レスポンスに必要なメタデータ (`Retry-After` / `X-RateLimit-*`)
 * を返す。route ハンドラ側はこれをそのまま `rateLimitExceededResponse` に渡せる。
 */
export interface IpRateLimitExceededError {
  readonly type: "RATE_LIMIT_EXCEEDED";
  /** ウィンドウ内に許可される最大リクエスト数 (`X-RateLimit-Limit`) */
  readonly limit: number;
  /** 現在のウィンドウ内での残り可能回数 (超過時は 0) */
  readonly remaining: number;
  /** クライアントが再試行可能になるまでの秒数 (`Retry-After`, 整数, 最低 1) */
  readonly retryAfterSeconds: number;
  /** 現在のウィンドウがリセットされる UNIX エポック秒 (`X-RateLimit-Reset`) */
  readonly reset: number;
}

export interface IpRateLimitPort {
  consume(ipAddress: string): Result<void, IpRateLimitExceededError>;
}
