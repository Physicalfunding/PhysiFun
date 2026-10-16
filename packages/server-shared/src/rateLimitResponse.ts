import { NextResponse } from "next/server";

/** 429 レスポンスに載せるレート制限の情報 */
export interface RateLimitExceededInfo {
  /** ウィンドウ内で許可される最大リクエスト数 (`X-RateLimit-Limit`) */
  limit: number;
  /** 現在のウィンドウ内での残り可能回数 (`X-RateLimit-Remaining`) */
  remaining: number;
  /** 再試行可能になるまでの秒数 (`Retry-After`) */
  retryAfterSeconds: number;
  /** カウンタがリセットされる UNIX エポック秒 (`X-RateLimit-Reset`) */
  reset: number;
}

/** 429 レスポンスボディ */
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
 * `Retry-After` ヘッダーと JSON ボディの両方に秒数を入れる。
 */
export function rateLimitExceededResponse(info: RateLimitExceededInfo): NextResponse {
  const body: RateLimitErrorBody = {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "リクエストが多すぎます。しばらく時間をおいて再度お試しください。",
      retryAfter: info.retryAfterSeconds,
    },
  };
  return NextResponse.json(body, {
    status: 429,
    headers: {
      "Retry-After": String(info.retryAfterSeconds),
      "X-RateLimit-Limit": String(info.limit),
      "X-RateLimit-Remaining": String(info.remaining),
      "X-RateLimit-Reset": String(info.reset),
    },
  });
}
