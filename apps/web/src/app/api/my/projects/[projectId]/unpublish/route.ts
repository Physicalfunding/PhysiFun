import { UnpublishProjectUseCase, type UnpublishProjectError } from "@physifun/application";
import { getProjectStatusPort } from "@/lib/di/project";
import { getCurrentUserId } from "@/lib/session";
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
function handleError(error: UnpublishProjectError) {
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
      return errorResponse("現在のステータスでは非公開にできません", "UNPROCESSABLE_ENTITY", 422);
  }
}

/**
 * POST /api/my/projects/[projectId]/unpublish
 * リーダー自主非公開化: PUBLISHED → DRAFT
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

    const { projectId } = await params;
    const port = getProjectStatusPort();
    const useCase = new UnpublishProjectUseCase(port);

    const result = await useCase.execute({
      accountId: userId,
      projectId,
    });

    if (!result.ok) {
      return handleError(result.error);
    }

    return successResponse(result.value);
  } catch (error) {
    console.error("[api/my/projects/[projectId]/unpublish] POST error:", error);
    return internalErrorResponse();
  }
}
