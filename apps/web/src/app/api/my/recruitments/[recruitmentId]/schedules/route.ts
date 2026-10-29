import { AddScheduleUseCase } from "@physifun/application";
import { getRecruitmentPort } from "@/lib/di/recruitment";
import { getCurrentUserId } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import { invalidBodyResponse, recruitmentErrorResponse } from "@/lib/recruitmentApi";
import { scheduleSchema } from "@/lib/validations/scheduleSchema";
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@physifun/server-shared";

/**
 * POST /api/my/recruitments/[recruitmentId]/schedules
 * サポート募集に日程を追加する（同じ日付の日程は 1 募集に 1 つ）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ recruitmentId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // レート制限: 募集・日程の書き込み API 合算で 30 req / min / user
    const limited = await enforceRateLimit("manageRecruitment", userId);
    if (limited) return limited;

    const { recruitmentId } = await params;
    // JSON として読めない本文は、検証エラー（400）にする
    const body: unknown = await request.json().catch(() => null);
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return invalidBodyResponse(parsed.error);
    }

    const useCase = new AddScheduleUseCase(getRecruitmentPort());
    const result = await useCase.execute({
      accountId: userId,
      recruitmentId,
      ...parsed.data,
    });

    if (!result.ok) {
      return recruitmentErrorResponse(result.error);
    }

    return successResponse(result.value, 201);
  } catch (error) {
    console.error("[api/my/recruitments/[recruitmentId]/schedules] POST error:", error);
    return internalErrorResponse();
  }
}
