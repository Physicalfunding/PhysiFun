import { type Result, err, ok } from "../../shared/result";

/**
 * 1 時間あたりの定員の範囲（上限は仮値: 100 人）
 *
 * 定員そのものはリーダーが日程ごとに決める。ここで決めているのは、システムが受け付ける範囲だけ。
 */
const LIMITS = {
  min: 1,
  max: 100,
} as const;

/**
 * CapacityPerHour 値オブジェクト
 *
 * 募集スケジュールの 1 時間ごとの定員（人数）。`LIMITS.min`〜`LIMITS.max` の整数。
 */
export class CapacityPerHour {
  private constructor(readonly value: number) {}

  static from(value: number): Result<CapacityPerHour, InvalidCapacityPerHourError> {
    if (!Number.isInteger(value) || value < LIMITS.min || value > LIMITS.max) {
      return err({
        type: "INVALID_CAPACITY_PER_HOUR",
        value,
        min: LIMITS.min,
        max: LIMITS.max,
      });
    }
    return ok(new CapacityPerHour(value));
  }

  equals(other: CapacityPerHour): boolean {
    return this.value === other.value;
  }
}

export interface InvalidCapacityPerHourError {
  readonly type: "INVALID_CAPACITY_PER_HOUR";
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

export const CAPACITY_PER_HOUR_LIMITS = LIMITS;
