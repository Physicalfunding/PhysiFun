import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScheduleRepository } from "@/infrastructure/database/repositories/PrismaScheduleRepository";
import { PrismaParticipationRepository } from "@/infrastructure/database/repositories/PrismaParticipationRepository";
import { UpdateScheduleUseCase } from "@/application/use-cases/schedule/UpdateScheduleUseCase";
import { DeleteScheduleUseCase } from "@/application/use-cases/schedule/DeleteScheduleUseCase";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId, isHost } from "@/lib/session";

/**
 * PUT /api/projects/[id]/schedules/[scheduleId]
 * スケジュールを更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    // 1. 認証チェック
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // 2. ホスト権限チェック
    const hostPermission = await isHost();
    if (!hostPermission) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "スケジュールを更新するにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // 3. パラメータとリクエストボディ取得
    const { scheduleId } = await params;
    const body = await request.json();

    // 4. ユースケースの実行
    const projectRepository = new PrismaProjectRepository(prisma);
    const scheduleRepository = new PrismaScheduleRepository(prisma);
    const useCase = new UpdateScheduleUseCase(projectRepository, scheduleRepository);

    const result = await useCase.execute({
      scheduleId,
      hostId: userId,
      title: body.title,
      description: body.description,
      startDateTime: body.startDateTime ? new Date(body.startDateTime) : undefined,
      duration: body.duration,
      capacity: body.capacity,
      requirements: body.requirements,
    });

    if (!result.success) {
      return handleAppError(result.error);
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Update schedule error:", error);
    return internalServerError();
  }
}

/**
 * DELETE /api/projects/[id]/schedules/[scheduleId]
 * スケジュールを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    // 1. 認証チェック
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // 2. ホスト権限チェック
    const hostPermission = await isHost();
    if (!hostPermission) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "スケジュールを削除するにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // 3. パラメータ取得
    const { scheduleId } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    // 4. ユースケースの実行
    const projectRepository = new PrismaProjectRepository(prisma);
    const scheduleRepository = new PrismaScheduleRepository(prisma);
    const participationRepository = new PrismaParticipationRepository(prisma);
    const useCase = new DeleteScheduleUseCase(
      projectRepository,
      scheduleRepository,
      participationRepository
    );

    const result = await useCase.execute({
      scheduleId,
      hostId: userId,
      force,
    });

    if (!result.success) {
      return handleAppError(result.error);
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Delete schedule error:", error);
    return internalServerError();
  }
}
