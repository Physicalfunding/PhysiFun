import { NextRequest } from "next/server";
import { z } from "zod";
import {
  CreateProjectDraftUseCase,
  type CreateProjectDraftError,
} from "@physifun/application";
import {
  getProjectQueryService,
  getProjectCommandAdapter,
} from "@/lib/di/project";
import { getCurrentUserId } from "@/lib/session";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  forbiddenResponse,
  errorResponse,
  internalErrorResponse,
} from "@/lib/api/response";

const queryService = getProjectQueryService();

/**
 * GET /api/my/projects
 * ログインユーザーの全プロジェクト一覧を取得する
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const result = await queryService.findProjectsByOwner(userId);
    return successResponse(result);
  } catch (error) {
    console.error("[api/my/projects] GET error:", error);
    return internalErrorResponse();
  }
}

// ---- POST 用バリデーション ----

const createProjectBody = z.object({
  title: z.string().min(1, "タイトルは必須です"),
});

/**
 * UseCase のエラー型に応じた HTTP レスポンスを返す
 */
function handleCreateError(error: CreateProjectDraftError) {
  switch (error.type) {
    case "INVALID_ACCOUNT_ID":
      return validationErrorResponse("無効なアカウントIDです");
    case "ACCOUNT_NOT_FOUND":
      return validationErrorResponse("アカウントが見つかりません");
    case "NOT_LEADER":
      return forbiddenResponse("リーダー権限が必要です");
    case "PROJECT_LIMIT_EXCEEDED":
      return errorResponse(
        `プロジェクト数の上限（${error.max}件）に達しています`,
        "UNPROCESSABLE_ENTITY",
        422
      );
    case "DOMAIN_ERROR":
      return validationErrorResponse("入力内容を確認してください");
  }
}

/**
 * POST /api/my/projects
 * 新規 DRAFT プロジェクトを作成する
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const parsed = createProjectBody.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fields[path]) fields[path] = [];
        fields[path].push(issue.message);
      }
      return validationErrorResponse("入力内容を確認してください", fields);
    }

    const adapter = getProjectCommandAdapter();
    const useCase = new CreateProjectDraftUseCase(adapter);
    const result = await useCase.execute({
      accountId: userId,
      title: parsed.data.title,
    });

    if (!result.ok) {
      return handleCreateError(result.error);
    }

    return successResponse(result.value, 201);
  } catch (error) {
    console.error("[api/my/projects] POST error:", error);
    return internalErrorResponse();
  }
}
