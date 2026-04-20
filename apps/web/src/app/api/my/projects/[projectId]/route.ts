import { NextRequest } from "next/server";
import { UpdateProjectDraftUseCase, type UpdateProjectDraftError } from "@physifun/application";
import { getProjectQueryService, getProjectCommandAdapter } from "@/lib/di/project";
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
import { projectFormSchema } from "@/lib/validations/projectFormSchema";

/**
 * GET /api/my/projects/[projectId]
 * プロジェクト詳細を取得する（オーナー向け）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const { projectId } = await params;
    const queryService = getProjectQueryService();
    const detail = await queryService.findProjectDetailForOwner(projectId, userId);
    if (!detail) {
      return notFoundResponse("プロジェクト");
    }

    return successResponse(detail);
  } catch (error) {
    console.error("[api/my/projects/[projectId]] GET error:", error);
    return internalErrorResponse();
  }
}

/**
 * UseCase のエラー型に応じた HTTP レスポンスを返す
 */
function handleUpdateError(error: UpdateProjectDraftError) {
  switch (error.type) {
    case "INVALID_ACCOUNT_ID":
      return validationErrorResponse("無効なアカウントIDです");
    case "PROJECT_NOT_FOUND":
      return notFoundResponse("プロジェクト");
    case "NOT_OWNER":
      return forbiddenResponse("このプロジェクトの編集権限がありません");
    case "CANNOT_EDIT_PUBLISHED":
      return errorResponse("公開中のプロジェクトは直接編集できません", "UNPROCESSABLE_ENTITY", 422);
    case "DOMAIN_ERROR":
      return validationErrorResponse("入力内容を確認してください");
    case "INVALID_CATEGORY":
      return validationErrorResponse("無効なカテゴリです", {
        category: [`無効な値: ${error.value}`],
      });
    case "INVALID_LOCATION":
      return validationErrorResponse("無効な地域情報です", {
        location: error.issues,
      });
    case "INVALID_SNS_LINKS":
      return validationErrorResponse("SNSリンクの入力を確認してください", {
        snsLinks: error.issues,
      });
    case "INVALID_PHASE":
      return validationErrorResponse("無効なフェーズです", {
        phase: [`無効な値: ${error.value}`],
      });
  }
}

/**
 * PATCH /api/my/projects/[projectId]
 * プロジェクトを更新する
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // レート制限: 30 req / min / user
    const limited = enforceRateLimit("updateProject", userId);
    if (limited) return limited;

    const { projectId } = await params;
    const body = await request.json();

    // partial バリデーション
    const parsed = projectFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fields[path]) fields[path] = [];
        fields[path].push(issue.message);
      }
      return validationErrorResponse("入力内容を確認してください", fields);
    }

    const data = parsed.data;

    // UseCase 入力に変換
    const adapter = getProjectCommandAdapter();
    const useCase = new UpdateProjectDraftUseCase(adapter);

    const result = await useCase.execute({
      projectId,
      accountId: userId,
      title: data.title,
      coverImageUrl: data.coverImageUrl || null,
      category: data.category,
      location:
        data.prefectureCode !== undefined
          ? data.prefectureCode
            ? { prefectureCode: data.prefectureCode, municipality: data.municipality }
            : null
          : undefined,
      phase: data.phase,
      summary: data.summary,
      body: data.body,
      leaderIntroduction: data.leaderIntroduction,
      activityPlan: data.activityPlan,
      snsLinks: data.snsLinks
        ? {
            x: data.snsLinks.x || null,
            instagram: data.snsLinks.instagram || null,
            facebook: data.snsLinks.facebook || null,
            website: data.snsLinks.website || null,
          }
        : undefined,
    });

    if (!result.ok) {
      return handleUpdateError(result.error);
    }

    return successResponse({
      projectId: result.value.projectId,
      withdrawnFromPending: result.value.withdrawnFromPending,
    });
  } catch (error) {
    console.error("[api/my/projects/[projectId]] PATCH error:", error);
    return internalErrorResponse();
  }
}
