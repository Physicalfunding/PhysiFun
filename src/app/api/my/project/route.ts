import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { GetMyProjectUseCase } from "@/application/use-cases/project/GetMyProjectUseCase";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId, isHost } from "@/lib/session";

/**
 * マイプロジェクト取得API
 * GET /api/my/project
 *
 * ホストが自分のプロジェクト情報を取得
 */
export async function GET() {
  try {
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
            message: "プロジェクトを表示するにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // リポジトリとユースケースの初期化
    const projectRepository = new PrismaProjectRepository(prisma);
    const useCase = new GetMyProjectUseCase(projectRepository);

    // ユースケースの実行
    const result = await useCase.execute(userId);

    if (!result.success) {
      return handleAppError(result.error);
    }

    // プロジェクトがない場合は204を返す
    if (result.data === null) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Failed to get my project:", error);
    return internalServerError("プロジェクトの取得に失敗しました");
  }
}
