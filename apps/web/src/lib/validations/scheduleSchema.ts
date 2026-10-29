import { z } from "zod";
import { APPROVAL_MODE_VALUES, CAPACITY_PER_HOUR_LIMITS } from "@physifun/domain";

/** JST の "HH:00"（"00:00"〜"23:00"。domain の TimeRange と同じく "24:00" は受け付けない） */
const HOUR_REGEX = /^(?:[01]\d|2[0-3]):00$/;

/**
 * サポート募集の日程（日付・時間帯・1 時間ごとの定員・承認モード）の項目
 *
 * 値の範囲は domain に合わせる。実在しない日付（2 月 30 日など）と過去の日付は、
 * ユースケース（`ScheduleDate`・`SCHEDULE_DATE_IN_PAST`）が止める。
 */
const scheduleFields = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を選んでください"),
  startTime: z.string().regex(HOUR_REGEX, "開始時刻を選んでください"),
  endTime: z.string().regex(HOUR_REGEX, "終了時刻を選んでください"),
  capacityPerHour: z
    .number({ invalid_type_error: "定員を入力してください" })
    .int("定員は整数で入力してください")
    .min(CAPACITY_PER_HOUR_LIMITS.min, `定員は${CAPACITY_PER_HOUR_LIMITS.min}人以上です`)
    .max(CAPACITY_PER_HOUR_LIMITS.max, `定員は${CAPACITY_PER_HOUR_LIMITS.max}人以下です`),
  approvalMode: z.enum(APPROVAL_MODE_VALUES, { message: "承認モードを選んでください" }),
});

/**
 * 終了が開始より後か（どちらも "HH:00" なので、文字列の大小で比べられる）。
 * 片方しか無いときは、ユースケースが今の値と合わせて確かめる。
 * 形式が誤っているときは、その項目のエラーだけを出すために比べない（Zod v3 は regex の失敗のあとも refine を実行する）。
 */
function endsAfterStart(value: { startTime?: string; endTime?: string }): boolean {
  if (value.startTime === undefined || value.endTime === undefined) return true;
  if (!HOUR_REGEX.test(value.startTime) || !HOUR_REGEX.test(value.endTime)) return true;
  return value.endTime > value.startTime;
}

const END_AFTER_START = {
  message: "終了時刻は開始時刻より後にしてください",
  path: ["endTime"],
};

/**
 * 日程の追加フォームと API の Zod スキーマ
 */
export const scheduleSchema = scheduleFields.refine(endsAfterStart, END_AFTER_START);

/**
 * 日程の更新 API の Zod スキーマ（指定した項目だけ）
 */
export const scheduleUpdateSchema = scheduleFields
  .partial()
  .refine(endsAfterStart, END_AFTER_START);

export type ScheduleFormValues = z.infer<typeof scheduleSchema>;
