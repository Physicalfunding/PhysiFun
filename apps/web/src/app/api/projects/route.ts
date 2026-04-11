import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { GetPublishedProjectsUseCase } from "@/application/use-cases/project/GetPublishedProjectsUseCase";
import { CreateProjectUseCase } from "@/application/use-cases/project/CreateProjectUseCase";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId, isHost } from "@/lib/session";
import { Category } from "@/domain/project/entities/Project";

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

/**
 * プロジェクト作成API
 * POST /api/projects
 *
 * ホスト権限を持つユーザーが新規プロジェクトを作成
 * ビジネスルール: 1アカウントにつき1プロジェクトのみ作成可能
 *
 * Request Body:
 * - title: string (必須)
 * - summary: string (必須)
 * - description: string (必須)
 * - category: Category (必須)
 * - location: string (必須)
 */
export async function POST(request: NextRequest) {
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
            message: "プロジェクトを作成するにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // 3. リクエストボディの取得
    const body = await request.json();
    const { title, summary, description, category, location } = body;

    // 4. リポジトリとユースケースの初期化
    const projectRepository = new PrismaProjectRepository(prisma);
    const useCase = new CreateProjectUseCase(projectRepository);

    // 5. ユースケースの実行
    const result = await useCase.execute({
      hostId: userId,
      title,
      summary,
      description,
      category: category as Category,
      location,
    });

    // 6. エラーハンドリング
    if (!result.success) {
      return handleAppError(result.error);
    }

    // 7. 成功レスポンス（201 Created）
    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return internalServerError("プロジェクトの作成に失敗しました");
  }
}
