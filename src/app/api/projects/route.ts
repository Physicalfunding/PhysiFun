import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { GetPublishedProjectsUseCase } from "@/application/use-cases/project/GetPublishedProjectsUseCase";
import { handleAppError, internalServerError } from "@/lib/api-helpers";

/**
 * 公開プロジェクト一覧取得API
 * GET /api/projects
 *
 * 公開中の全プロジェクトをカード表示用のDTO形式で返却
 * 認証不要（誰でもアクセス可能）
 */
export async function GET() {
  try {
    // リポジトリとユースケースの初期化
    const projectRepository = new PrismaProjectRepository(prisma);
    const useCase = new GetPublishedProjectsUseCase(projectRepository);

    // ユースケースの実行
    const result = await useCase.execute();

    // エラーハンドリング
    if (!result.success) {
      return handleAppError(result.error);
    }

    // 成功レスポンス
    return NextResponse.json(result.data);
  } catch (error) {
    // 予期せぬエラー
    console.error("Failed to fetch projects:", error);
    return internalServerError("プロジェクト一覧の取得に失敗しました");
  }
}
