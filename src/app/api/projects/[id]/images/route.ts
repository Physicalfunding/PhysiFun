import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { UploadProjectImagesUseCase } from "@/application/use-cases/project/UploadProjectImagesUseCase";
import { DeleteProjectImageUseCase } from "@/application/use-cases/project/DeleteProjectImageUseCase";
import { ReorderProjectImagesUseCase } from "@/application/use-cases/project/ReorderProjectImagesUseCase";
import { getImageUploadService } from "@/infrastructure/storage/ImageUploadService";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId, isHost } from "@/lib/session";

/**
 * 最大ファイルサイズ（5MB）
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/projects/[id]/images
 * プロジェクト画像をアップロード
 *
 * リクエスト:
 * - FormData { files: File[] }
 *
 * レスポンス:
 * - 200: アップロード成功 { imageUrls: string[] }
 * - 400: バリデーションエラー
 * - 401: 未認証
 * - 403: 権限なし
 * - 413: ファイルサイズ超過
 * - 500: サーバーエラー
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
            message: "画像をアップロードするにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // 3. パラメータ取得
    const { id: projectId } = await params;

    // 4. FormDataからファイルを取得
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "ファイルが選択されていません",
          },
        },
        { status: 400 }
      );
    }

    // 5. ファイルサイズのプリチェック
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `ファイルサイズは5MB以下にしてください（${file.name}）`,
            },
          },
          { status: 413 }
        );
      }
    }

    // 6. ファイルをBufferに変換
    const imageFiles = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          buffer: Buffer.from(arrayBuffer),
        };
      })
    );

    // 7. ユースケースの実行
    const projectRepository = new PrismaProjectRepository(prisma);
    const imageUploadService = getImageUploadService();
    const useCase = new UploadProjectImagesUseCase(projectRepository, imageUploadService);

    const result = await useCase.execute({
      projectId,
      hostId: userId,
      files: imageFiles,
    });

    // 8. 結果の処理
    if (!result.success) {
      return handleAppError(result.error);
    }

    // 9. 成功レスポンス
    return NextResponse.json({
      imageUrls: result.data.imageUrls,
    });
  } catch (error) {
    console.error("Project image upload error:", error);
    return internalServerError();
  }
}

/**
 * DELETE /api/projects/[id]/images
 * プロジェクト画像を削除
 *
 * リクエスト:
 * - JSON { imageIndex: number }
 *
 * レスポンス:
 * - 200: 削除成功 { imageUrls: string[] }
 * - 400: バリデーションエラー
 * - 401: 未認証
 * - 403: 権限なし
 * - 404: プロジェクトが見つからない
 * - 500: サーバーエラー
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
            message: "画像を削除するにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // 3. パラメータ取得
    const { id: projectId } = await params;

    // 4. リクエストボディを取得
    const body = await request.json();
    const { imageIndex } = body;

    if (imageIndex === undefined || typeof imageIndex !== "number") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "削除する画像のインデックスを指定してください",
          },
        },
        { status: 400 }
      );
    }

    // 5. ユースケースの実行
    const projectRepository = new PrismaProjectRepository(prisma);
    const imageUploadService = getImageUploadService();
    const useCase = new DeleteProjectImageUseCase(projectRepository, imageUploadService);

    const result = await useCase.execute({
      projectId,
      hostId: userId,
      imageIndex,
    });

    // 6. 結果の処理
    if (!result.success) {
      return handleAppError(result.error);
    }

    // 7. 成功レスポンス
    return NextResponse.json({
      imageUrls: result.data.imageUrls,
    });
  } catch (error) {
    console.error("Project image delete error:", error);
    return internalServerError();
  }
}

/**
 * PATCH /api/projects/[id]/images
 * プロジェクト画像の順序を変更
 *
 * リクエスト:
 * - JSON { newOrder: number[] }
 *
 * レスポンス:
 * - 200: 並び替え成功 { imageUrls: string[] }
 * - 400: バリデーションエラー
 * - 401: 未認証
 * - 403: 権限なし
 * - 404: プロジェクトが見つからない
 * - 500: サーバーエラー
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
            message: "画像を並び替えるにはホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // 3. パラメータ取得
    const { id: projectId } = await params;

    // 4. リクエストボディを取得
    const body = await request.json();
    const { newOrder } = body;

    if (!Array.isArray(newOrder)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "新しい順序の配列を指定してください",
          },
        },
        { status: 400 }
      );
    }

    // 5. ユースケースの実行
    const projectRepository = new PrismaProjectRepository(prisma);
    const useCase = new ReorderProjectImagesUseCase(projectRepository);

    const result = await useCase.execute({
      projectId,
      hostId: userId,
      newOrder,
    });

    // 6. 結果の処理
    if (!result.success) {
      return handleAppError(result.error);
    }

    // 7. 成功レスポンス
    return NextResponse.json({
      imageUrls: result.data.imageUrls,
    });
  } catch (error) {
    console.error("Project image reorder error:", error);
    return internalServerError();
  }
}
