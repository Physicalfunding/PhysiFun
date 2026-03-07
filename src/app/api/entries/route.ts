import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CreateOwnerEntryUseCase } from "@/application/use-cases/entry/CreateOwnerEntryUseCase";
import { PrismaOwnerEntryRepository } from "@/infrastructure/database/repositories/PrismaOwnerEntryRepository";
import { prisma } from "@/infrastructure/database/prisma";
import { AppError } from "@/domain/shared/result";

/**
 * オーナー応募リクエストのバリデーションスキーマ
 * @see https://zod.dev
 */
const entrySchema = z.object({
  name: z
    .string()
    .min(1, "お名前を入力してください")
    .max(100, "お名前は100文字以内で入力してください"),
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("有効なメールアドレスを入力してください"),
  projectTitle: z
    .string()
    .min(1, "プロジェクトタイトルを入力してください")
    .max(200, "プロジェクトタイトルは200文字以内で入力してください"),
  projectSummary: z
    .string()
    .min(1, "プロジェクト概要を入力してください")
    .max(500, "プロジェクト概要は500文字以内で入力してください"),
  projectStory: z
    .string()
    .min(1, "プロジェクト説明を入力してください")
    .max(5000, "プロジェクト説明は5000文字以内で入力してください"),
});

/**
 * POST /api/entries
 * オーナー応募エンドポイント
 *
 * リクエストボディ:
 * - name: 応募者名
 * - email: 連絡先メールアドレス
 * - projectTitle: プロジェクトタイトル
 * - projectSummary: プロジェクト概要
 * - projectStory: プロジェクト説明（ストーリー・想い）
 *
 * レスポンス:
 * - 201: 応募受付成功
 * - 400: バリデーションエラー
 * - 500: サーバーエラー
 */
export async function POST(request: NextRequest) {
  try {
    // 1. リクエストボディの解析
    const body = await request.json();

    // 2. バリデーション
    const validationResult = entrySchema.safeParse(body);
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
    const repository = new PrismaOwnerEntryRepository(prisma);
    const useCase = new CreateOwnerEntryUseCase(repository);

    const result = await useCase.execute({
      name: validationResult.data.name,
      email: validationResult.data.email,
      projectTitle: validationResult.data.projectTitle,
      projectSummary: validationResult.data.projectSummary,
      projectStory: validationResult.data.projectStory,
    });

    // 4. 結果の処理
    if (!result.success) {
      return handleAppError(result.error);
    }

    // 5. 成功レスポンス
    return NextResponse.json(
      {
        entry: {
          id: result.data.id.toString(),
          name: result.data.name,
          email: result.data.email,
          projectTitle: result.data.projectTitle,
          status: result.data.status,
          createdAt: result.data.createdAt.toISOString(),
        },
        message: "応募を受け付けました。審査結果は追ってご連絡いたします。",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Entry error:", error);
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
