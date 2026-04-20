import { WithdrawProjectUseCase, type WithdrawProjectError } from "@physifun/application";
import { getProjectStatusPort } from "@/lib/di/project";
import { getCurrentUserId } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  errorResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api/response";

/**
 * UseCase のエラー型に応じた HTTP レスポンスを返す
 */
function handleError(error: WithdrawProjectError) {
  switch (error.type) {
    case "INVALID_ACCOUNT_ID":
      return validationErrorResponse("無効なアカウントIDです");
    case "INVALID_PROJECT_ID":
      return validationErrorResponse("無効なプロジェクトIDです");
    case "PROJECT_NOT_FOUND":
      return notFoundResponse("プロジェクト");
    case "NOT_OWNER":
      return forbiddenResponse("このプロジェクトの操作権限がありません");
    case "DOMAIN_ERROR":
      return errorResponse("現在のステータスでは取下げできません", "UNPROCESSABLE_ENTITY", 422);
  }
}

/**
 * POST /api/my/projects/[projectId]/withdraw
 * 自主取下げ: PENDING_REVIEW → DRAFT
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // レート制限: ステータス遷移系は request-publish / withdraw / unpublish の 3 ルート
    // 合算で 10 req/min/user を消費する (Issue #108 原文「Status transitions: 10 req / min / user」に従う)。
    const limited = enforceRateLimit("projectStatusTransition", userId);
    if (limited) return limited;

    const { projectId } = await params;
    const port = getProjectStatusPort();
    const useCase = new WithdrawProjectUseCase(port);

    const result = await useCase.execute({
      accountId: userId,
      projectId,
    });

    if (!result.ok) {
      return handleError(result.error);
    }

    return successResponse(result.value);
  } catch (error) {
    console.error("[api/my/projects/[projectId]/withdraw] POST error:", error);
    return internalErrorResponse();
  }
}
