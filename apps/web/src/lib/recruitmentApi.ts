import type { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type {
  AddScheduleError,
  CreateRecruitmentError,
  DeleteRecruitmentError,
  ListRecruitmentsError,
  RemoveScheduleError,
  UpdateRecruitmentError,
  UpdateScheduleError,
} from "@physifun/application";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "@physifun/server-shared";

/**
 * 募集・日程 API のユースケースが返すエラー
 */
export type RecruitmentApiError =
  | ListRecruitmentsError
  | CreateRecruitmentError
  | UpdateRecruitmentError
  | DeleteRecruitmentError
  | AddScheduleError
  | UpdateScheduleError
  | RemoveScheduleError;

/**
 * 募集・日程のユースケースのエラーを HTTP レスポンスに変える（募集・日程 API の Route Handler で共通）
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
    case "INVALID_SCHEDULE_ID":
      return validationErrorResponse("無効な日程IDです");
    case "DOMAIN_ERROR":
    // 日程の項目は Route Handler の Zod でほぼ止まる。ここに来るのは、実在しない日付（2 月 30 日など）や、
    // 時刻を片方だけ変えて前後が逆になったときなど
    case "INVALID_SCHEDULE_DATE":
    case "INVALID_TIME_RANGE":
    case "INVALID_CAPACITY_PER_HOUR":
    case "INVALID_APPROVAL_MODE":
      return validationErrorResponse("入力内容を確認してください");
    case "SCHEDULE_DATE_IN_PAST":
      return unprocessableEntityResponse("過去の日付には設定できません");
    case "DUPLICATE_SCHEDULE_DATE":
      return conflictResponse("この日付の日程はすでにあります");
    case "PROJECT_NOT_FOUND":
      return notFoundResponse("プロジェクト");
    case "RECRUITMENT_NOT_FOUND":
      return notFoundResponse("募集");
    case "SCHEDULE_NOT_FOUND":
      return notFoundResponse("日程");
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
