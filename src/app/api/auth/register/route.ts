import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RegisterUserUseCase } from "@/application/use-cases/auth/RegisterUserUseCase";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";
import { prisma } from "@/infrastructure/database/prisma";
import { UserType } from "@/domain/account/entities/User";
import { AppError } from "@/domain/shared/result";

/**
 * ユーザー登録リクエストのバリデーションスキーマ
 * @see https://zod.dev
 */
const registerSchema = z.object({
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("無効なメールアドレス形式です"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  name: z.string().min(1, "名前を入力してください").max(100, "名前は100文字以内で入力してください"),
  userType: z.enum(["HOST", "GUEST"], {
    errorMap: () => ({ message: "ユーザータイプを選択してください" }),
  }),
});

/**
 * POST /api/auth/register
 * 新規ユーザー登録エンドポイント
 *
 * リクエストボディ:
 * - email: メールアドレス
 * - password: パスワード (8文字以上)
 * - name: ユーザー名
 * - userType: HOST | GUEST
 *
 * レスポンス:
 * - 201: ユーザー作成成功
 * - 400: バリデーションエラー
 * - 409: メールアドレス重複
 * - 500: サーバーエラー
 */
export async function POST(request: NextRequest) {
  try {
    // 1. リクエストボディの解析
    const body = await request.json();

    // 2. バリデーション
    const validationResult = registerSchema.safeParse(body);
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

    // 3. ユースケースの実行
    const userRepository = new PrismaUserRepository(prisma);
    const useCase = new RegisterUserUseCase(userRepository);

    const result = await useCase.execute({
      email: validationResult.data.email,
      password: validationResult.data.password,
      name: validationResult.data.name,
      userType: validationResult.data.userType as UserType,
    });

    // 4. 結果の処理
    if (!result.success) {
      return handleAppError(result.error);
    }

    // 5. 成功レスポンス（パスワードハッシュは除外）
    return NextResponse.json(
      {
        user: {
          id: result.data.id.value,
          email: result.data.email.value,
          name: result.data.name,
          userType: result.data.userType,
          createdAt: result.data.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "サーバーエラーが発生しました",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * AppErrorをHTTPレスポンスに変換するヘルパー関数
 */
function handleAppError(error: AppError): NextResponse {
  switch (error.code) {
    case "VALIDATION_ERROR":
      return NextResponse.json({ error }, { status: 400 });
    case "CONFLICT":
      return NextResponse.json({ error }, { status: 409 });
    case "UNAUTHORIZED":
      return NextResponse.json({ error }, { status: 401 });
    case "FORBIDDEN":
      return NextResponse.json({ error }, { status: 403 });
    case "NOT_FOUND":
      return NextResponse.json({ error }, { status: 404 });
    default:
      return NextResponse.json({ error }, { status: 500 });
  }
}
