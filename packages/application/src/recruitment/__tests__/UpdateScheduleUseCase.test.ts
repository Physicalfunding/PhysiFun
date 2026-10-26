import { describe, it, expect, beforeEach } from "vitest";
import { ApprovalMode, ScheduleDateConflictError } from "@physifun/domain";
import { UpdateScheduleUseCase, type UpdateScheduleInput } from "../UpdateScheduleUseCase";
import {
  InMemoryRecruitmentPort,
  MISSING_ID,
  OTHER_ACCOUNT_ID,
  OTHER_SCHEDULE_ID,
  OWNER_ACCOUNT_ID,
  RECRUITMENT_ID,
  SCHEDULE_ID,
  createRecruitment,
  createSchedule,
} from "./fixtures";

describe("UpdateScheduleUseCase", () => {
  let port: InMemoryRecruitmentPort;
  let useCase: UpdateScheduleUseCase;

  /** 変更対象は SCHEDULE_ID（2099-01-10 の 10:00〜15:00・定員 5・AUTO） */
  function seed(targetDate = "2099-01-10") {
    port.recruitments.push(
      createRecruitment([
        createSchedule({ id: SCHEDULE_ID, date: targetDate }),
        createSchedule({ id: OTHER_SCHEDULE_ID, date: "2099-01-20" }),
      ])
    );
  }

  beforeEach(() => {
    port = new InMemoryRecruitmentPort();
    useCase = new UpdateScheduleUseCase(port);
  });

  const base: UpdateScheduleInput = {
    accountId: OWNER_ACCOUNT_ID,
    recruitmentId: RECRUITMENT_ID,
    scheduleId: SCHEDULE_ID,
  };

  // ---- ハッピーパス ----

  it("指定した項目だけ変わり、ルートが返した日程が保存される", async () => {
    seed();

    const result = await useCase.execute({
      ...base,
      date: "2099-01-15",
      capacityPerHour: 10,
      approvalMode: ApprovalMode.MANUAL,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.scheduleId).toBe(SCHEDULE_ID);
    expect(port.updatedSchedules).toHaveLength(1);
    const saved = port.updatedSchedules[0];
    expect(saved.date.toString()).toBe("2099-01-15");
    expect(saved.capacityPerHour.value).toBe(10);
    expect(saved.approvalMode).toBe(ApprovalMode.MANUAL);
    expect(saved.timeRange.start).toBe("10:00");
    expect(saved.timeRange.end).toBe("15:00");
    // ルートの updateSchedule() を通っている（集約の日程も差し替わっている）
    expect(port.recruitments[0].schedules).toContain(saved);
  });

  it("開始時刻だけ指定すると、終了は今の値のまま", async () => {
    seed();

    const result = await useCase.execute({ ...base, startTime: "12:00" });

    expect(result.ok).toBe(true);
    expect(port.updatedSchedules[0].timeRange.start).toBe("12:00");
    expect(port.updatedSchedules[0].timeRange.end).toBe("15:00");
  });

  it("過去の日程でも、日付を変えなければ編集できる（今と同じ日付が送られてきても可）", async () => {
    seed("2000-01-01");

    const result = await useCase.execute({ ...base, date: "2000-01-01", capacityPerHour: 8 });

    expect(result.ok).toBe(true);
    expect(port.updatedSchedules[0].capacityPerHour.value).toBe(8);
  });

  // ---- エラーケース ----

  it.each([
    ["INVALID_ACCOUNT_ID", { accountId: "not-a-uuid" }],
    ["INVALID_RECRUITMENT_ID", { recruitmentId: "not-a-uuid" }],
    ["INVALID_SCHEDULE_ID", { scheduleId: "not-a-uuid" }],
    ["RECRUITMENT_NOT_FOUND", { recruitmentId: MISSING_ID }],
    ["NOT_OWNER", { accountId: OTHER_ACCOUNT_ID }],
    ["SCHEDULE_NOT_FOUND", { scheduleId: MISSING_ID }],
    ["INVALID_SCHEDULE_DATE", { date: "2099/01/15" }],
    ["SCHEDULE_DATE_IN_PAST", { date: "2000-01-01" }],
    // 終了だけ変えて、今の開始（10:00）より前になる
    ["INVALID_TIME_RANGE", { endTime: "09:00" }],
    ["INVALID_CAPACITY_PER_HOUR", { capacityPerHour: 1.5 }],
    ["INVALID_APPROVAL_MODE", { approvalMode: "auto" }],
  ] as const)("%s を返し、日程は保存しない", async (type, override) => {
    seed();

    const result = await useCase.execute({ ...base, ...override });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe(type);
    expect(port.hasWrites).toBe(false);
  });

  it("変更後の日付の日程がすでにあると DUPLICATE_SCHEDULE_DATE（保存しない）", async () => {
    seed();

    const result = await useCase.execute({ ...base, date: "2099-01-20" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "DUPLICATE_SCHEDULE_DATE", date: "2099-01-20" });
    expect(port.hasWrites).toBe(false);
  });

  it("同時に同じ日付へ変更され、保存で ScheduleDateConflictError が出ると DUPLICATE_SCHEDULE_DATE", async () => {
    seed();
    port.scheduleWriteError = new ScheduleDateConflictError("2099-01-15");

    const result = await useCase.execute({ ...base, date: "2099-01-15" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "DUPLICATE_SCHEDULE_DATE", date: "2099-01-15" });
  });

  it("保存でそれ以外の例外が出たら、そのまま投げる", async () => {
    seed();
    port.scheduleWriteError = new Error("connection lost");

    await expect(useCase.execute({ ...base, capacityPerHour: 10 })).rejects.toThrow(
      "connection lost"
    );
  });
});
