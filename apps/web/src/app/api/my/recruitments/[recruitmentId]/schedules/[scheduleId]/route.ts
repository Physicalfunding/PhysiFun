import { RemoveScheduleUseCase, UpdateScheduleUseCase } from "@physifun/application";
import { getRecruitmentPort } from "@/lib/di/recruitment";
import { getCurrentUserId } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import { invalidBodyResponse, recruitmentErrorResponse } from "@/lib/recruitmentApi";
import { scheduleUpdateSchema } from "@/lib/validations/scheduleSchema";
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@physifun/server-shared";

/*
 * 日程がその募集のものかは、ユースケースが募集の日程から探して確かめる
 * （別の募集の日程の ID を指定すると 404 になる）。
 */

/**
 * PATCH /api/my/recruitments/[recruitmentId]/schedules/[scheduleId]
 * 日程を更新する（指定した項目だけ）
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ recruitmentId: string; scheduleId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // レート制限: 募集・日程の書き込み API 合算で 30 req / min / user
    const limited = await enforceRateLimit("manageRecruitment", userId);
    if (limited) return limited;

    const { recruitmentId, scheduleId } = await params;
    // JSON として読めない本文は、検証エラー（400）にする
    const body: unknown = await request.json().catch(() => null);
    const parsed = scheduleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return invalidBodyResponse(parsed.error);
    }

    const useCase = new UpdateScheduleUseCase(getRecruitmentPort());
    const result = await useCase.execute({
      accountId: userId,
      recruitmentId,
      scheduleId,
      ...parsed.data,
    });

    if (!result.ok) {
      return recruitmentErrorResponse(result.error);
    }

    return successResponse(result.value);
  } catch (error) {
    console.error(
      "[api/my/recruitments/[recruitmentId]/schedules/[scheduleId]] PATCH error:",
      error
    );
    return internalErrorResponse();
  }
}

/**
 * DELETE /api/my/recruitments/[recruitmentId]/schedules/[scheduleId]
 * 日程を削除する（過去の日程も削除できる）
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ recruitmentId: string; scheduleId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // レート制限: 募集・日程の書き込み API 合算で 30 req / min / user
    const limited = await enforceRateLimit("manageRecruitment", userId);
    if (limited) return limited;

    const { recruitmentId, scheduleId } = await params;
    const useCase = new RemoveScheduleUseCase(getRecruitmentPort());
    const result = await useCase.execute({ accountId: userId, recruitmentId, scheduleId });

    if (!result.ok) {
      return recruitmentErrorResponse(result.error);
    }

    return successResponse(result.value);
  } catch (error) {
    console.error(
      "[api/my/recruitments/[recruitmentId]/schedules/[scheduleId]] DELETE error:",
      error
    );
    return internalErrorResponse();
  }
}
