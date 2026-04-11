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

/**
 * 権限エラーレスポンスを生成するヘルパー関数
 *
 * @param message - エラーメッセージ（デフォルト: "この操作を行う権限がありません"）
 * @returns 403ステータスのNextResponse
 */
export function forbiddenResponse(
  message: string = "この操作を行う権限がありません"
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "FORBIDDEN",
        message,
      },
    },
    { status: 403 }
  );
}

/**
 * 見つからないエラーレスポンスを生成するヘルパー関数
 *
 * @param resource - リソース名（例: "プロジェクト"）
 * @returns 404ステータスのNextResponse
 */
export function notFoundResponse(resource: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "NOT_FOUND",
        message: `${resource}が見つかりません`,
      },
    },
    { status: 404 }
  );
}

/**
 * バリデーションエラーレスポンスを生成するヘルパー関数
 *
 * @param message - エラーメッセージ
 * @param fields - フィールドごとのエラーメッセージ
 * @returns 400ステータスのNextResponse
 */
export function validationErrorResponse(
  message: string,
  fields?: Record<string, string[]>
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message,
        ...(fields && { fields }),
      },
    },
    { status: 400 }
  );
}

/**
 * 競合エラーレスポンスを生成するヘルパー関数
 *
 * @param message - エラーメッセージ
 * @returns 409ステータスのNextResponse
 */
export function conflictResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "CONFLICT",
        message,
      },
    },
    { status: 409 }
  );
}

/**
 * ビジネスロジックエラーレスポンスを生成するヘルパー関数
 * バリデーションは通過したが、ビジネスルールに違反する場合に使用
 * 例: 定員オーバー、重複申し込み、過去日時の設定など
 *
 * @param message - エラーメッセージ
 * @returns 422ステータスのNextResponse
 */
export function unprocessableEntityResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "UNPROCESSABLE_ENTITY",
        message,
      },
    },
    { status: 422 }
  );
}

/**
 * 成功レスポンスを生成するヘルパー関数
 *
 * @param data - レスポンスデータ
 * @param status - HTTPステータスコード（デフォルト: 200）
 * @returns 指定ステータスのNextResponse
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
