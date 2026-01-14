import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScheduleRepository } from "@/infrastructure/database/repositories/PrismaScheduleRepository";
import { CreateScheduleUseCase } from "@/application/use-cases/schedule/CreateScheduleUseCase";
import { GetSchedulesUseCase } from "@/application/use-cases/schedule/GetSchedulesUseCase";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId, isHost } from "@/lib/session";

/**
 * GET /api/projects/[id]/schedules
 * プロジェクトのスケジュール一覧を取得
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const upcomingOnly = searchParams.get("upcoming") === "true";

    const projectRepository = new PrismaProjectRepository(prisma);
    const scheduleRepository = new PrismaScheduleRepository(prisma);
    const useCase = new GetSchedulesUseCase(projectRepository, scheduleRepository);

    const result = await useCase.execute({
      projectId,
      upcomingOnly,
    });

    if (!result.success) {
      return handleAppError(result.error);
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Get schedules error:", error);
    return internalServerError();
  }
}

/**
 * POST /api/projects/[id]/schedules
 * スケジュールを作成
 *
 * リクエスト:
 * - JSON { title, description, startDateTime, duration?, capacity, requirements? }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
            message: "スケジュールを作成するにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // 3. パラメータとリクエストボディ取得
    const { id: projectId } = await params;
    const body = await request.json();

    // 4. ユースケースの実行
    const projectRepository = new PrismaProjectRepository(prisma);
    const scheduleRepository = new PrismaScheduleRepository(prisma);
    const useCase = new CreateScheduleUseCase(projectRepository, scheduleRepository);

    const result = await useCase.execute({
      projectId,
      hostId: userId,
      title: body.title,
      description: body.description,
      startDateTime: new Date(body.startDateTime),
      duration: body.duration,
      capacity: body.capacity,
      requirements: body.requirements,
    });

    if (!result.success) {
      return handleAppError(result.error);
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("Create schedule error:", error);
    return internalServerError();
  }
}
