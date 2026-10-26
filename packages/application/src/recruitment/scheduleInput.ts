import {
  type ApprovalMode,
  type InvalidCapacityPerHourError,
  type InvalidScheduleDateError,
  type Result,
  type ScheduleDate,
  TimeRange,
  type TimeRangeError,
  err,
  isApprovalMode,
  ok,
} from "@physifun/domain";

/**
 * 日程の入力（プリミティブ）を検証したときのエラー（AddSchedule / UpdateSchedule で共通）
 *
 * 日付・定員は値オブジェクトのエラーをそのまま使う。時間帯は理由が 3 通りあるので `reason` に包む。
 */
export type ScheduleInputError =
  | InvalidScheduleDateError
  | { readonly type: "INVALID_TIME_RANGE"; readonly reason: TimeRangeError }
  | InvalidCapacityPerHourError
  | { readonly type: "INVALID_APPROVAL_MODE"; readonly value: string }
  | { readonly type: "SCHEDULE_DATE_IN_PAST"; readonly date: string };

/**
 * `"HH:MM"` の開始・終了から TimeRange を作る。
 */
export function toTimeRange(start: string, end: string): Result<TimeRange, ScheduleInputError> {
  const result = TimeRange.create({ start, end });
  if (!result.ok) {
    return err({ type: "INVALID_TIME_RANGE", reason: result.error });
  }
  return result;
}

/**
 * 文字列を ApprovalMode に絞り込む。
 */
export function toApprovalMode(value: string): Result<ApprovalMode, ScheduleInputError> {
  if (!isApprovalMode(value)) {
    return err({ type: "INVALID_APPROVAL_MODE", value });
  }
  return ok(value);
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 日付が JST の今日より前か（今日は含めない）。
 *
 * `ScheduleDate` は JST のカレンダー日なので、今の時刻を 9 時間進めて UTC の年月日を取り、
 * `"YYYY-MM-DD"` の文字列で比べる（文字列の大小がそのまま日付の前後になる）。JST に夏時間は無い。
 */
export function isPastInJst(date: ScheduleDate): boolean {
  const today = new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
  return date.toString() < today;
}
