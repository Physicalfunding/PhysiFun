import type { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type {
  CreateRecruitmentError,
  DeleteRecruitmentError,
  ListRecruitmentsError,
  UpdateRecruitmentError,
} from "@physifun/application";
import {
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@physifun/server-shared";

/**
 * 募集 API のユースケースが返すエラー
 */
export type RecruitmentApiError =
  | ListRecruitmentsError
  | CreateRecruitmentError
  | UpdateRecruitmentError
  | DeleteRecruitmentError;

/**
 * 募集のユースケースのエラーを HTTP レスポンスに変える（募集 API の Route Handler で共通）
 *
 * エラーの型はユースケースどうしでほとんど同じなので、1 か所で変換する。
 */
export function recruitmentErrorResponse(error: RecruitmentApiError): NextResponse {
  switch (error.type) {
    case "INVALID_ACCOUNT_ID":
      return validationErrorResponse("無効なアカウントIDです");
    case "INVALID_PROJECT_ID":
      return validationErrorResponse("無効なプロジェクトIDです");
    case "INVALID_RECRUITMENT_ID":
      return validationErrorResponse("無効な募集IDです");
    case "DOMAIN_ERROR":
      return validationErrorResponse("入力内容を確認してください");
    case "PROJECT_NOT_FOUND":
      return notFoundResponse("プロジェクト");
    case "RECRUITMENT_NOT_FOUND":
      return notFoundResponse("募集");
    case "NOT_OWNER":
      return forbiddenResponse("このプロジェクトの募集を操作する権限がありません");
  }
}

/**
 * Zod の検証エラーを、項目ごとのメッセージ付きの 400 にする
 */
export function invalidBodyResponse(error: ZodError): NextResponse {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!fields[path]) fields[path] = [];
    fields[path].push(issue.message);
  }
  return validationErrorResponse("入力内容を確認してください", fields);
}
