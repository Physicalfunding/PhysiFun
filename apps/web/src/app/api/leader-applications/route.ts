import { NextRequest } from "next/server";
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
} from "@/lib/api/response";
import { getSubmitLeaderApplicationPort } from "@/lib/di/leader-application";

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
 */
export async function POST(request: NextRequest) {
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

    return successResponse(result.value, 201);
  } catch (e) {
    console.error("[api] leader-applications POST error:", e);
    return internalErrorResponse();
  }
}
