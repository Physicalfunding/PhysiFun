import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PublishProjectUseCase } from "@/application/use-cases/project/PublishProjectUseCase";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId, isHost } from "@/lib/session";

/**
 * プロジェクト公開API
 * POST /api/projects/[id]/publish
 *
 * 下書きプロジェクトを公開状態に変更
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
            message: "プロジェクトを公開するにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // リポジトリとユースケースの初期化
    const projectRepository = new PrismaProjectRepository(prisma);
    const useCase = new PublishProjectUseCase(projectRepository);

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
    console.error("Failed to publish project:", error);
    return internalServerError("プロジェクトの公開に失敗しました");
  }
}
