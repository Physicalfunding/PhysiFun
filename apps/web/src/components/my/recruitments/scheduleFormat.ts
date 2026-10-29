import type { ApprovalMode } from "@physifun/domain";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 日程の日付（JST のカレンダー日 "YYYY-MM-DD"）を「2026年11月3日（火）」の形にする
 *
 * 曜日は UTC で組み立てた日付から取る（実行環境のタイムゾーンに左右されない）。
 */
export function formatScheduleDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}年${month}月${day}日（${weekday}）`;
}

/**
 * JST の今日（"YYYY-MM-DD"）
 *
 * 日付の入力で過去の日付を選びにくくするために使う。過去の日付かどうかの判定はサーバー（ユースケース）が行う。
 */
export function todayInJst(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 承認モードの表示名
 */
export const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
  AUTO: "自動承認",
  MANUAL: "手動承認",
};
