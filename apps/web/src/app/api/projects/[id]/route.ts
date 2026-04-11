import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { GetProjectUseCase } from "@/application/use-cases/project/GetProjectUseCase";
import { UpdateProjectUseCase } from "@/application/use-cases/project/UpdateProjectUseCase";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId, isHost } from "@/lib/session";
import { Category } from "@/domain/project/entities/Project";

/**
 * プロジェクト詳細取得API
 * GET /api/projects/[id]
 *
 * ホストが自分のプロジェクト詳細を取得
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // 認証チェック
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // リポジトリとユースケースの初期化
    const projectRepository = new PrismaProjectRepository(prisma);
    const useCase = new GetProjectUseCase(projectRepository);

    // ユースケースの実行
    const result = await useCase.execute({
      projectId: id,
      hostId: userId,
    });

    if (!result.success) {
      return handleAppError(result.error);
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Failed to get project:", error);
    return internalServerError("プロジェクトの取得に失敗しました");
  }
}

/**
 * プロジェクト更新API
 * PUT /api/projects/[id]
 *
 * ホストが自分のプロジェクト情報を更新
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // 認証チェック
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // ホスト権限チェック
    const hostPermission = await isHost();
    if (!hostPermission) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "プロジェクトを編集するにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // リクエストボディの取得
    const body = await request.json();
    const { title, summary, description, category, location } = body;

    // リポジトリとユースケースの初期化
    const projectRepository = new PrismaProjectRepository(prisma);
    const useCase = new UpdateProjectUseCase(projectRepository);

    // ユースケースの実行
    const result = await useCase.execute({
      projectId: id,
      hostId: userId,
      title,
      summary,
      description,
      category: category as Category,
      location,
    });

    if (!result.success) {
      return handleAppError(result.error);
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Failed to update project:", error);
    return internalServerError("プロジェクトの更新に失敗しました");
  }
}
