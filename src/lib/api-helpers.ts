import { NextResponse } from "next/server";
import { AppError } from "@/domain/shared/result";

/**
 * AppErrorをHTTPレスポンスに変換するヘルパー関数
 * 各APIエンドポイントで共通で使用される
 *
 * @param error - AppError型のエラーオブジェクト
 * @returns 適切なステータスコードを持つNextResponse
 */
export function handleAppError(error: AppError): NextResponse {
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

/**
 * 内部サーバーエラーレスポンスを生成するヘルパー関数
 *
 * @param message - エラーメッセージ（デフォルト: "サーバーエラーが発生しました"）
 * @returns 500ステータスのNextResponse
 */
export function internalServerError(
  message: string = "サーバーエラーが発生しました"
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    },
    { status: 500 }
  );
}

/**
 * 認証エラーレスポンスを生成するヘルパー関数
 *
 * @param message - エラーメッセージ（デフォルト: "認証が必要です"）
 * @returns 401ステータスのNextResponse
 */
export function unauthorizedResponse(message: string = "認証が必要です"): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message,
      },
    },
    { status: 401 }
  );
}
