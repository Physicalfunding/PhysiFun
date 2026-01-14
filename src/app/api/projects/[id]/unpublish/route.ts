import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { UnpublishProjectUseCase } from "@/application/use-cases/project/UnpublishProjectUseCase";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId, isHost } from "@/lib/session";

/**
 * プロジェクト非公開API
 * POST /api/projects/[id]/unpublish
 *
 * 公開中のプロジェクトを下書き状態に戻す
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
            message: "プロジェクトを操作するにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // リポジトリとユースケースの初期化
    const projectRepository = new PrismaProjectRepository(prisma);
    const useCase = new UnpublishProjectUseCase(projectRepository);

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
    console.error("Failed to unpublish project:", error);
    return internalServerError("プロジェクトの非公開化に失敗しました");
  }
}
