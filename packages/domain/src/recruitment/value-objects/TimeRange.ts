import { type Result, err, ok } from "../../shared/result";

const HH_MM_REGEX = /^(\d{2}):(\d{2})$/;

/**
 * TimeRange 値オブジェクト
 *
 * 募集スケジュールの受付時間帯（JST）。開始・終了を `"HH:MM"` 形式の文字列で持つ。
 *
 * - 1 時間単位（分は `00` のみ）。定員を 1 時間ごとに数えるため
 * - 終了は開始より後（同じ時刻は不可）
 * - 使える時刻は `"00:00"`〜`"23:00"`。`"24:00"`（夜 12 時まで）は受け付けない
 *   （締切の計算で日付をまたぐ扱いが要るため。必要になったら広げる）
 */
export class TimeRange {
  private constructor(
    readonly start: string,
    readonly end: string
  ) {}

  static create(input: { start: string; end: string }): Result<TimeRange, TimeRangeError> {
    const startHour = parseHour(input.start, "start");
    if (!startHour.ok) return startHour;

    const endHour = parseHour(input.end, "end");
    if (!endHour.ok) return endHour;

    if (endHour.value <= startHour.value) {
      return err({ type: "END_NOT_AFTER_START", start: input.start, end: input.end });
    }
    return ok(new TimeRange(input.start, input.end));
  }

  equals(other: TimeRange): boolean {
    return this.start === other.start && this.end === other.end;
  }
}

/**
 * `"HH:00"` を検証して時（0〜23）を返す。
 */
function parseHour(value: string, field: "start" | "end"): Result<number, TimeRangeError> {
  const match = HH_MM_REGEX.exec(value);
  if (!match) {
    return err({ type: "INVALID_TIME_FORMAT", field, value });
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return err({ type: "INVALID_TIME_FORMAT", field, value });
  }
  if (minute !== 0) {
    return err({ type: "TIME_NOT_ON_THE_HOUR", field, value });
  }
  return ok(hour);
}

export type TimeRangeError =
  | {
      readonly type: "INVALID_TIME_FORMAT";
      readonly field: "start" | "end";
      readonly value: string;
    }
  | {
      readonly type: "TIME_NOT_ON_THE_HOUR";
      readonly field: "start" | "end";
      readonly value: string;
    }
  | {
      readonly type: "END_NOT_AFTER_START";
      readonly start: string;
      readonly end: string;
    };
