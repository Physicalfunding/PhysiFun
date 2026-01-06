import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GetProfileUseCase } from "@/application/use-cases/profile/GetProfileUseCase";
import { UpdateProfileUseCase } from "@/application/use-cases/profile/UpdateProfileUseCase";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";
import { prisma } from "@/infrastructure/database/prisma";
import { UserType } from "@/domain/account/entities/User";
import { handleAppError, internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/session";

/**
 * プロフィール更新リクエストのバリデーションスキーマ
 * @see https://zod.dev
 */
const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, "名前を入力してください")
    .max(100, "名前は100文字以内で入力してください")
    .optional(),
  bio: z
    .string()
    .max(500, "自己紹介は500文字以内で入力してください")
    .nullable()
    .optional(),
  userType: z
    .enum(["HOST", "GUEST", "BOTH"], {
      errorMap: () => ({ message: "ユーザータイプを選択してください" }),
    })
    .optional(),
});

/**
 * GET /api/users/me
 * 現在ログイン中のユーザーのプロフィールを取得
 *
 * レスポンス:
 * - 200: プロフィール取得成功
 * - 401: 未認証
 * - 404: ユーザーが見つからない
 * - 500: サーバーエラー
 */
export async function GET() {
  try {
    // 1. 認証チェック
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // 2. ユースケースの実行
    const userRepository = new PrismaUserRepository(prisma);
    const useCase = new GetProfileUseCase(userRepository);

    const result = await useCase.execute({ userId });

    // 3. 結果の処理
    if (!result.success) {
      return handleAppError(result.error);
    }

    // 4. 成功レスポンス
    return NextResponse.json({
      profile: result.data,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return internalServerError();
  }
}

/**
 * PATCH /api/users/me
 * 現在ログイン中のユーザーのプロフィールを更新
 *
 * リクエストボディ:
 * - name?: ユーザー名（オプション）
 * - bio?: 自己紹介文（オプション、null可）
 * - userType?: HOST | GUEST | BOTH（オプション）
 *
 * レスポンス:
 * - 200: プロフィール更新成功
 * - 400: バリデーションエラー
 * - 401: 未認証
 * - 404: ユーザーが見つからない
 * - 500: サーバーエラー
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. 認証チェック
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // 2. リクエストボディの解析
    const body = await request.json();

    // 3. バリデーション
    const validationResult = updateProfileSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.flatten();
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "入力内容に誤りがあります",
            fields: errors.fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    // 4. ユースケースの実行
    const userRepository = new PrismaUserRepository(prisma);
    const useCase = new UpdateProfileUseCase(userRepository);

    const result = await useCase.execute({
      userId,
      name: validationResult.data.name,
      bio: validationResult.data.bio,
      userType: validationResult.data.userType as UserType | undefined,
    });

    // 5. 結果の処理
    if (!result.success) {
      return handleAppError(result.error);
    }

    // 6. 成功レスポンス
    return NextResponse.json({
      profile: result.data,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return internalServerError();
  }
}
