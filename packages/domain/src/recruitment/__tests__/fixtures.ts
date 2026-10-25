import type { Result } from "../../shared/result";
import { CapacityPerHour } from "../value-objects/CapacityPerHour";
import { ScheduleDate } from "../value-objects/ScheduleDate";
import { TimeRange } from "../value-objects/TimeRange";

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`fixture broken: ${JSON.stringify(result.error)}`);
  return result.value;
}

export function date(value: string): ScheduleDate {
  return unwrap(ScheduleDate.from(value));
}

export function timeRange(start: string, end: string): TimeRange {
  return unwrap(TimeRange.create({ start, end }));
}

export function capacity(value: number): CapacityPerHour {
  return unwrap(CapacityPerHour.from(value));
}
