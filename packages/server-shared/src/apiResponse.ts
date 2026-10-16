import { NextResponse } from "next/server";

/**
 * APIエラーの種類を定義
 * 各エラーコードはHTTPステータスコードと対応
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR" // 400
  | "UNAUTHORIZED" // 401
  | "FORBIDDEN" // 403
  | "NOT_FOUND" // 404
  | "CONFLICT" // 409
  | "UNPROCESSABLE_ENTITY" // 422
  | "INTERNAL_ERROR"; // 500

/**
 * APIレスポンスの型定義
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string[]>;
  };
}

/**
 * 成功レスポンスを返す
 * @param data レスポンスデータ
 * @param status HTTPステータスコード（デフォルト: 200）
 * @returns NextResponse
 *
 * @example
 * return successResponse({ user: { id: "1", name: "田中太郎" } });
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  const body: ApiResponse<T> = {
    success: true,
    data,
  };
  return NextResponse.json(body, { status });
}

/**
 * エラーレスポンスを返す
 * @param message エラーメッセージ
 * @param code エラーコード
 * @param status HTTPステータスコード
 * @param fields フィールドごとのエラー（バリデーションエラー用）
 * @returns NextResponse
 */
export function errorResponse(
  message: string,
  code: ApiErrorCode,
  status: number,
  fields?: Record<string, string[]>
): NextResponse {
  const body: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(fields && { fields }),
    },
  };
  return NextResponse.json(body, { status });
}

/**
 * バリデーションエラーレスポンス（400）
 * 入力値の検証に失敗した場合に使用
 *
 * @example
 * return validationErrorResponse("入力内容を確認してください", {
 *   email: ["無効なメールアドレスです"],
 *   password: ["パスワードは8文字以上必要です"]
 * });
 */
export function validationErrorResponse(
  message: string,
  fields?: Record<string, string[]>
): NextResponse {
  return errorResponse(message, "VALIDATION_ERROR", 400, fields);
}

/**
 * 未認証エラーレスポンス（401）
 * ログインが必要な操作で未認証の場合に使用
 */
export function unauthorizedResponse(message = "ログインが必要です"): NextResponse {
  return errorResponse(message, "UNAUTHORIZED", 401);
}

/**
 * 権限エラーレスポンス（403）
 * 認証済みだが操作権限がない場合に使用
 */
export function forbiddenResponse(message = "この操作を行う権限がありません"): NextResponse {
  return errorResponse(message, "FORBIDDEN", 403);
}

/**
 * 見つからないエラーレスポンス（404）
 * リソースが存在しない場合に使用
 *
 * @param resource リソース名（例: "プロジェクト"）
 */
export function notFoundResponse(resource: string): NextResponse {
  return errorResponse(`${resource}が見つかりません`, "NOT_FOUND", 404);
}

/**
 * 競合エラーレスポンス（409）
 * リソースが既に存在する場合（重複登録など）に使用
 */
export function conflictResponse(message: string): NextResponse {
  return errorResponse(message, "CONFLICT", 409);
}

/**
 * ビジネスロジックエラーレスポンス（422）
 * バリデーションは通過したが、ビジネスルールに違反する場合に使用
 * 例: 定員オーバー、重複申し込み、過去日時の設定など
 */
export function unprocessableEntityResponse(message: string): NextResponse {
  return errorResponse(message, "UNPROCESSABLE_ENTITY", 422);
}

/**
 * サーバーエラーレスポンス（500）
 * 予期しないエラーが発生した場合に使用
 */
export function internalErrorResponse(message = "サーバーエラーが発生しました"): NextResponse {
  return errorResponse(message, "INTERNAL_ERROR", 500);
}
