import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaScheduleRepository } from "@/infrastructure/database/repositories/PrismaScheduleRepository";
import { PrismaParticipationRepository } from "@/infrastructure/database/repositories/PrismaParticipationRepository";
import { ApplyToScheduleUseCase } from "@/application/use-cases/participation/ApplyToScheduleUseCase";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId, isGuest } from "@/lib/session";

/**
 * POST /api/schedules/[scheduleId]/participate
 * 体験スケジュールへの参加申し込み
 *
 * リクエストボディ:
 * - participantCount: 参加人数（必須、1以上の整数）
 *
 * レスポンス:
 * - 201: 申し込み成功（Participationオブジェクトを返す）
 * - 400: バリデーションエラー（定員オーバー、参加人数不正など）
 * - 401: 未認証
 * - 403: ゲスト権限なし
 * - 404: スケジュールが見つからない
 * - 409: 既に申し込み済み
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  try {
    // 1. 認証チェック
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // 2. ゲスト権限チェック
    const guestPermission = await isGuest();
    if (!guestPermission) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "参加申し込みにはゲスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // 3. パラメータとリクエストボディ取得
    const { scheduleId } = await params;
    const body = await request.json();

    // 4. ユースケースの実行
    const scheduleRepository = new PrismaScheduleRepository(prisma);
    const participationRepository = new PrismaParticipationRepository(prisma);
    const useCase = new ApplyToScheduleUseCase(participationRepository, scheduleRepository);

    const result = await useCase.execute({
      userId,
      scheduleId,
      participantCount: body.participantCount,
    });

    if (!result.success) {
      return handleAppError(result.error);
    }

    // 5. レスポンス整形
    const participation = result.data;
    return NextResponse.json(
      {
        id: participation.id.value,
        guestId: participation.guestId.value,
        scheduleId: participation.scheduleId.value,
        participantCount: participation.participantCount,
        status: participation.status,
        appliedAt: participation.appliedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Participation error:", error);
    return internalServerError();
  }
}
