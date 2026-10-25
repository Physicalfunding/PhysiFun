import { type Result, err, ok } from "../../shared/result";

const YYYY_MM_DD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * ScheduleDate 値オブジェクト
 *
 * 募集スケジュールの開催日。**JST のカレンダー日** を `"YYYY-MM-DD"` の文字列で持つ。
 *
 * `Date` を持たないのは、タイムゾーンに左右されないようにするため
 * （`Date` は「ある瞬間」なので、どのタイムゾーンで見るかで日付がずれる）。
 * DB の `date` 型との変換はインフラ層が行う。
 *
 * 過去の日付かどうかは「今日」が要るので、ここでは見ない。
 */
export class ScheduleDate {
  private constructor(private readonly value: string) {}

  static from(value: string): Result<ScheduleDate, InvalidScheduleDateError> {
    const match = YYYY_MM_DD_REGEX.exec(value);
    if (!match || !isExistingDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
      return err({ type: "INVALID_SCHEDULE_DATE", value });
    }
    return ok(new ScheduleDate(value));
  }

  toString(): string {
    return this.value;
  }

  equals(other: ScheduleDate): boolean {
    return this.value === other.value;
  }
}

/**
 * 実在する日付かどうか（2 月 30 日などを弾く）。
 *
 * UTC で組み立てて年月日が変わらないかを見る。UTC なので実行環境のタイムゾーンに左右されない。
 */
function isExistingDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export interface InvalidScheduleDateError {
  readonly type: "INVALID_SCHEDULE_DATE";
  readonly value: string;
}
