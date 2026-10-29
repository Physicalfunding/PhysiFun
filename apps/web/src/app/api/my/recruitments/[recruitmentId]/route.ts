import { DeleteRecruitmentUseCase, UpdateRecruitmentUseCase } from "@physifun/application";
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

/*
 * 募集から先の操作は、プロジェクトの下ではなく `/api/my/recruitments/[recruitmentId]` に置く。
 * ユースケースは募集の ID だけで動き、所有者は募集が属するプロジェクトから調べるため
 * （URL に projectId を入れても、誰も確かめない値になる。#218）。
 */

/**
 * PATCH /api/my/recruitments/[recruitmentId]
 * サポート募集のタイトル・説明を更新する（指定した項目だけ）
 */
export async function PATCH(
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
    const parsed = recruitmentSchema.partial().safeParse(body);
    if (!parsed.success) {
      return invalidBodyResponse(parsed.error);
    }

    const useCase = new UpdateRecruitmentUseCase(getRecruitmentPort());
    const result = await useCase.execute({
      accountId: userId,
      recruitmentId,
      title: parsed.data.title,
      description: parsed.data.description,
    });

    if (!result.ok) {
      return recruitmentErrorResponse(result.error);
    }

    return successResponse(result.value);
  } catch (error) {
    console.error("[api/my/recruitments/[recruitmentId]] PATCH error:", error);
    return internalErrorResponse();
  }
}

/**
 * DELETE /api/my/recruitments/[recruitmentId]
 * サポート募集を削除する（日程も一緒に消える）
 */
export async function DELETE(
  _request: Request,
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
    const useCase = new DeleteRecruitmentUseCase(getRecruitmentPort());
    const result = await useCase.execute({ accountId: userId, recruitmentId });

    if (!result.ok) {
      return recruitmentErrorResponse(result.error);
    }

    return successResponse(result.value);
  } catch (error) {
    console.error("[api/my/recruitments/[recruitmentId]] DELETE error:", error);
    return internalErrorResponse();
  }
}
