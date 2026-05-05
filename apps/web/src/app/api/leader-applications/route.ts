import { after, NextRequest } from "next/server";
import {
  SubmitLeaderApplicationUseCase,
  type SubmitLeaderApplicationError,
} from "@physifun/application";
import {
  successResponse,
  validationErrorResponse,
  conflictResponse,
  errorResponse,
  internalErrorResponse,
  serviceUnavailableResponse,
} from "@/lib/api/response";
import { getSubmitLeaderApplicationPort } from "@/lib/di/leader-application";
import { getLeaderApplicationOutboxWorker } from "@/lib/di/outbox";
import { isLeaderApplicationEnabledServer } from "@/lib/featureFlags";

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
      return errorResponse(
        "送信回数の上限に達しました。しばらく時間をおいてから再度お試しください",
        "UNPROCESSABLE_ENTITY",
        429
      );
    case "CAPTCHA_VERIFICATION_FAILED":
      return validationErrorResponse("CAPTCHA の検証に失敗しました");
    case "DUPLICATE_PENDING_APPLICATION":
      return conflictResponse("このメールアドレスでは既に応募が登録されています");
  }
}

/**
 * POST /api/leader-applications
 * リーダー応募を送信する
 *
 * TODO(#192): CAPTCHA / IP レートリミットがスタブのままなので、本番環境では
 * `LEADER_APPLICATION_ENABLED` flag を立てるまで 503 を返す。
 */
export async function POST(request: NextRequest) {
  // フィーチャーフラグゲート (PR #198 review C1)
  if (!isLeaderApplicationEnabledServer()) {
    return serviceUnavailableResponse("リーダー応募の受付は現在準備中です");
  }

  try {
    const body = await request.json();
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const useCase = new SubmitLeaderApplicationUseCase(getSubmitLeaderApplicationPort());
    const result = await useCase.execute({
      ...body,
      ipAddress,
      captchaToken: body.captchaToken ?? "stub",
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
