import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApprovalMode, ScheduleDateConflictError } from "@physifun/domain";
import { AddScheduleUseCase, type AddScheduleInput } from "../AddScheduleUseCase";
import {
  InMemoryRecruitmentPort,
  MISSING_ID,
  OTHER_ACCOUNT_ID,
  OWNER_ACCOUNT_ID,
  RECRUITMENT_ID,
  createRecruitment,
  createSchedule,
} from "./fixtures";

describe("AddScheduleUseCase", () => {
  let port: InMemoryRecruitmentPort;
  let useCase: AddScheduleUseCase;

  beforeEach(() => {
    port = new InMemoryRecruitmentPort();
    // 2099-01-10 の日程がすでにある
    port.recruitments.push(createRecruitment([createSchedule({ date: "2099-01-10" })]));
    useCase = new AddScheduleUseCase(port);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const validInput: AddScheduleInput = {
    accountId: OWNER_ACCOUNT_ID,
    recruitmentId: RECRUITMENT_ID,
    date: "2099-02-01",
    startTime: "09:00",
    endTime: "12:00",
    capacityPerHour: 3,
    approvalMode: ApprovalMode.MANUAL,
  };

  // ---- ハッピーパス ----

  it("所有者が追加すると scheduleId が返り、ルートが作った日程が保存される", async () => {
    const result = await useCase.execute(validInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(port.addedSchedules).toHaveLength(1);
    const saved = port.addedSchedules[0];
    expect(result.value.scheduleId).toBe(saved.id.toString());
    expect(saved.supportRecruitmentId.toString()).toBe(RECRUITMENT_ID);
    expect(saved.date.toString()).toBe("2099-02-01");
    expect(saved.timeRange.start).toBe("09:00");
    expect(saved.timeRange.end).toBe("12:00");
    expect(saved.capacityPerHour.value).toBe(3);
    expect(saved.approvalMode).toBe(ApprovalMode.MANUAL);
    // ルートの addSchedule() を通っている（集約にも入っている）
    expect(port.recruitments[0].schedules).toContain(saved);
  });

  // ---- 過去の日付（JST） ----

  it("JST の今日の日付は追加できる。前日は SCHEDULE_DATE_IN_PAST", async () => {
    // UTC では 5/1 15:30、JST では 5/2 0:30
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-05-01T15:30:00Z"));

    const today = await useCase.execute({ ...validInput, date: "2030-05-02" });
    expect(today.ok).toBe(true);

    const yesterday = await useCase.execute({ ...validInput, date: "2030-05-01" });
    expect(yesterday.ok).toBe(false);
    if (yesterday.ok) return;
    expect(yesterday.error).toEqual({ type: "SCHEDULE_DATE_IN_PAST", date: "2030-05-01" });
    expect(port.addedSchedules).toHaveLength(1);
  });

  // ---- エラーケース ----

  it.each([
    ["INVALID_ACCOUNT_ID", { accountId: "not-a-uuid" }],
    ["INVALID_RECRUITMENT_ID", { recruitmentId: "not-a-uuid" }],
    ["RECRUITMENT_NOT_FOUND", { recruitmentId: MISSING_ID }],
    ["NOT_OWNER", { accountId: OTHER_ACCOUNT_ID }],
    ["INVALID_SCHEDULE_DATE", { date: "2099-02-30" }],
    ["SCHEDULE_DATE_IN_PAST", { date: "2000-01-01" }],
    ["INVALID_TIME_RANGE", { startTime: "12:00", endTime: "09:00" }],
    ["INVALID_CAPACITY_PER_HOUR", { capacityPerHour: 0 }],
    ["INVALID_APPROVAL_MODE", { approvalMode: "SOMETIMES" }],
  ] as const)("%s を返し、日程は保存しない", async (type, override) => {
    const result = await useCase.execute({ ...validInput, ...override });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe(type);
    expect(port.hasWrites).toBe(false);
  });

  it("時間帯のエラーは理由つきで返る", async () => {
    const result = await useCase.execute({ ...validInput, startTime: "09:30" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      type: "INVALID_TIME_RANGE",
      reason: { type: "TIME_NOT_ON_THE_HOUR", field: "start", value: "09:30" },
    });
  });

  it("同じ日付の日程がすでにあると DUPLICATE_SCHEDULE_DATE（保存しない）", async () => {
    const result = await useCase.execute({ ...validInput, date: "2099-01-10" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "DUPLICATE_SCHEDULE_DATE", date: "2099-01-10" });
    expect(port.hasWrites).toBe(false);
  });

  it("同時に同じ日付が追加され、保存で ScheduleDateConflictError が出ると DUPLICATE_SCHEDULE_DATE", async () => {
    port.scheduleWriteError = new ScheduleDateConflictError("2099-02-01");

    const result = await useCase.execute(validInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "DUPLICATE_SCHEDULE_DATE", date: "2099-02-01" });
  });

  it("保存でそれ以外の例外が出たら、そのまま投げる", async () => {
    port.scheduleWriteError = new Error("connection lost");

    await expect(useCase.execute(validInput)).rejects.toThrow("connection lost");
  });
});
