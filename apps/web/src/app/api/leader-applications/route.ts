import { NextRequest } from "next/server";
import {
  SubmitLeaderApplicationUseCase,
  type SubmitLeaderApplicationPort,
  type SubmitLeaderApplicationError,
} from "@physifun/application";
import {
  successResponse,
  validationErrorResponse,
  conflictResponse,
  errorResponse,
  internalErrorResponse,
} from "@/lib/api/response";

/**
 * SubmitLeaderApplicationPort のスタブ実装
 *
 * TODO: infrastructure 層に Prisma 実装を作成し、このスタブを置き換える
 */
const stubPort: SubmitLeaderApplicationPort = {
  async findAccountByEmail(_email: string) {
    // TODO: Prisma で Account を検索する実装に置き換え
    return null;
  },
  async executeInTransaction(_params) {
    // TODO: Prisma トランザクションで Account + LeaderApplication + OutboxMessage を作成する実装に置き換え
    return;
  },
};

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

    const useCase = new SubmitLeaderApplicationUseCase(stubPort);
    const result = await useCase.execute({
      ...body,
      ipAddress,
      captchaToken: body.captchaToken ?? "stub",
    });

    if (!result.ok) {
      return handleUseCaseError(result.error);
    }

    return successResponse(result.value, 201);
  } catch {
    return internalErrorResponse();
  }
}
