import { after, NextRequest } from "next/server";
import {
  SubmitLeaderApplicationUseCase,
  type SubmitLeaderApplicationError,
} from "@physifun/application";
import {
  successResponse,
  validationErrorResponse,
  conflictResponse,
  forbiddenResponse,
  internalErrorResponse,
} from "@/lib/api/response";
import {
  getCaptchaVerifierPort,
  getLeaderApplicationIpRateLimitPort,
  getSubmitLeaderApplicationPort,
} from "@/lib/di/leader-application";
import { getLeaderApplicationOutboxWorker } from "@/lib/di/outbox";
import { rateLimitExceededResponse } from "@/lib/rateLimit";

/**
 * UseCase のエラー型に応じた HTTP レスポンスを返す
 */
function handleUseCaseError(error: SubmitLeaderApplicationError) {
  switch (error.type) {
    case "VALIDATION_ERROR": {
      const fields: Record<string, string[]> = {};
      for (const issue of error.issues) {
        if (!fields[issue.path]) {
          fields[issue.path] = [];
        }
        fields[issue.path].push(issue.message);
      }
      return validationErrorResponse("入力内容を確認してください", fields);
    }
    case "RATE_LIMIT_EXCEEDED":
      // ポートが返した rate limit メタデータを使い、既存ルートと整合する
      // `Retry-After` / `X-RateLimit-*` ヘッダー付きの 429 を返す。
      return rateLimitExceededResponse({
        ok: false,
        limit: error.limit,
        remaining: error.remaining,
        retryAfterSeconds: error.retryAfterSeconds,
        reset: error.reset,
      });
    case "CAPTCHA_VERIFICATION_FAILED":
      // ボット判定の失敗はフィールド検証エラーではないので 403 で返す。
      return forbiddenResponse("CAPTCHA の検証に失敗しました。再度お試しください");
    case "DUPLICATE_PENDING_APPLICATION":
      return conflictResponse("このメールアドレスでは既に応募が登録されています");
  }
}

/**
 * POST /api/leader-applications
 * リーダー応募を送信する。
 *
 * Issue #200: CAPTCHA (Cloudflare Turnstile) と IP レートリミット
 * (`leaderApplicationSubmit`: 3 req / 1 hour / IP) で未認証スパムを抑止する。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // NOTE (Issue #200): `x-forwarded-for` の最左 IP は Vercel edge が信頼できる値で
    // 書き換える前提。セルフホスト/別 PaaS にデプロイする場合はクライアント任意で
    // 偽装可能になり、レートリミット回避が成立する点に注意。
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const useCase = new SubmitLeaderApplicationUseCase(
      getSubmitLeaderApplicationPort(),
      getCaptchaVerifierPort(),
      getLeaderApplicationIpRateLimitPort()
    );
    const result = await useCase.execute({
      ...body,
      ipAddress,
    });

    if (!result.ok) {
      return handleUseCaseError(result.error);
    }

    // 即時送信トリガー (#187 B 経路)
    // レスポンス送信後に Outbox を 1 バッチ tick して ACTIVATION_EMAIL を即送信する。
    // ここで失敗しても OutboxMessage は PENDING のまま残るので、cron (A 経路) が翌日
    // までに復旧させる。
    after(async () => {
      try {
        await getLeaderApplicationOutboxWorker().tick();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[after] leader-applications outbox tick failed:", message);
      }
    });

    return successResponse(result.value, 201);
  } catch (e) {
    console.error("[api] leader-applications POST error:", e);
    return internalErrorResponse();
  }
}
