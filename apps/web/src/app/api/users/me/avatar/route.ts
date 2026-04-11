import { NextRequest, NextResponse } from "next/server";
import { UpdateAvatarUseCase } from "@/application/use-cases/profile/UpdateAvatarUseCase";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";
import { prisma } from "@/infrastructure/database/prisma";
import { getImageUploadService } from "@/infrastructure/storage/ImageUploadService";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/session";

/**
 * 最大ファイルサイズ（5MB）
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/users/me/avatar
 * アバター画像をアップロード
 *
 * リクエスト:
 * - FormData { file: File }
 *
 * レスポンス:
 * - 200: アップロード成功 { avatarUrl: string }
 * - 400: バリデーションエラー
 * - 401: 未認証
 * - 413: ファイルサイズ超過
 * - 415: サポートされていないファイル形式
 * - 500: サーバーエラー
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 認証チェック
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // 2. FormDataからファイルを取得
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
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

    // 3. ファイルサイズのプリチェック
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "ファイルサイズは5MB以下にしてください",
          },
        },
        { status: 413 }
      );
    }

    // 4. ファイルをBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. ユースケースの実行
    const userRepository = new PrismaUserRepository(prisma);
    const imageUploadService = getImageUploadService();
    const useCase = new UpdateAvatarUseCase(userRepository, imageUploadService);

    const result = await useCase.execute({
      userId,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        buffer,
      },
    });

    // 6. 結果の処理
    if (!result.success) {
      return handleAppError(result.error);
    }

    // 7. 成功レスポンス
    return NextResponse.json({
      avatarUrl: result.data.avatarUrl,
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return internalServerError();
  }
}
