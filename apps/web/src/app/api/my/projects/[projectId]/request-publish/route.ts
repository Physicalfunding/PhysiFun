import { RequestPublishUseCase, type RequestPublishError } from "@physifun/application";
import { getRequestPublishPort } from "@/lib/di/project";
import { getCurrentUserId } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  validationErrorResponse,
  errorResponse,
  internalErrorResponse,
} from "@/lib/api/response";

/**
 * UseCase のエラー型に応じた HTTP レスポンスを返す
 */
function handleError(error: RequestPublishError) {
  switch (error.type) {
    case "INVALID_ACCOUNT_ID":
      return validationErrorResponse("無効なアカウントIDです");
    case "INVALID_PROJECT_ID":
      return validationErrorResponse("無効なプロジェクトIDです");
    case "PROJECT_NOT_FOUND":
      return notFoundResponse("プロジェクト");
    case "NOT_OWNER":
      return forbiddenResponse("このプロジェクトの操作権限がありません");
    case "DOMAIN_ERROR": {
      const domainErr = error.domainError;
      if (domainErr.type === "PUBLICATION_REQUIREMENTS_NOT_MET") {
        return errorResponse("公開に必要な項目が未入力です", "UNPROCESSABLE_ENTITY", 422);
      }
      return errorResponse("現在のステータスでは公開申請できません", "UNPROCESSABLE_ENTITY", 422);
    }
  }
}

/**
 * POST /api/my/projects/[projectId]/request-publish
 * 公開申請: DRAFT → PENDING_REVIEW
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

    // レート制限: 10 req / min / user (ステータス遷移系)
    const limited = enforceRateLimit("projectStatusTransition", userId);
    if (limited) return limited;

    const { projectId } = await params;
    const port = getRequestPublishPort();
    const useCase = new RequestPublishUseCase(port);

    const result = await useCase.execute({
      accountId: userId,
      projectId,
    });

    if (!result.ok) {
      return handleError(result.error);
    }

    return successResponse(result.value);
  } catch (error) {
    console.error("[api/my/projects/[projectId]/request-publish] POST error:", error);
    return internalErrorResponse();
  }
}
