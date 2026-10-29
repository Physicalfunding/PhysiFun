import { CreateRecruitmentUseCase, ListRecruitmentsUseCase } from "@physifun/application";
import { getRecruitmentPort } from "@/lib/di/recruitment";
import { getCurrentUserId } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import { invalidBodyResponse, recruitmentErrorResponse } from "@/lib/recruitmentApi";
import { recruitmentSchema } from "@/lib/validations/recruitmentSchema";
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@physifun/server-shared";

/**
 * GET /api/my/projects/[projectId]/recruitments
 * プロジェクトのサポート募集を日程ごと一覧する（オーナー向け）
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const { projectId } = await params;
    const useCase = new ListRecruitmentsUseCase(getRecruitmentPort());
    const result = await useCase.execute({ accountId: userId, projectId });

    if (!result.ok) {
      return recruitmentErrorResponse(result.error);
    }

    return successResponse(result.value);
  } catch (error) {
    console.error("[api/my/projects/[projectId]/recruitments] GET error:", error);
    return internalErrorResponse();
  }
}

/**
 * POST /api/my/projects/[projectId]/recruitments
 * プロジェクトにサポート募集を作成する（日程はまだ無い）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // レート制限: 募集・日程の書き込み API 合算で 30 req / min / user
    const limited = await enforceRateLimit("manageRecruitment", userId);
    if (limited) return limited;

    const { projectId } = await params;
    // JSON として読めない本文は、検証エラー（400）にする
    const body: unknown = await request.json().catch(() => null);
    const parsed = recruitmentSchema.safeParse(body);
    if (!parsed.success) {
      return invalidBodyResponse(parsed.error);
    }

    const useCase = new CreateRecruitmentUseCase(getRecruitmentPort());
    const result = await useCase.execute({
      accountId: userId,
      projectId,
      title: parsed.data.title,
      description: parsed.data.description,
    });

    if (!result.ok) {
      return recruitmentErrorResponse(result.error);
    }

    return successResponse(result.value, 201);
  } catch (error) {
    console.error("[api/my/projects/[projectId]/recruitments] POST error:", error);
    return internalErrorResponse();
  }
}
