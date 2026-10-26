import { describe, it, expect, beforeEach } from "vitest";
import { RemoveScheduleUseCase } from "../RemoveScheduleUseCase";
import {
  InMemoryRecruitmentPort,
  MISSING_ID,
  OTHER_ACCOUNT_ID,
  OWNER_ACCOUNT_ID,
  RECRUITMENT_ID,
  SCHEDULE_ID,
  createRecruitment,
  createSchedule,
} from "./fixtures";

describe("RemoveScheduleUseCase", () => {
  let port: InMemoryRecruitmentPort;
  let useCase: RemoveScheduleUseCase;

  beforeEach(() => {
    port = new InMemoryRecruitmentPort();
    port.recruitments.push(createRecruitment([createSchedule({ id: SCHEDULE_ID })]));
    useCase = new RemoveScheduleUseCase(port);
  });

  const base = {
    accountId: OWNER_ACCOUNT_ID,
    recruitmentId: RECRUITMENT_ID,
    scheduleId: SCHEDULE_ID,
  };

  // ---- ハッピーパス ----

  it("所有者が削除すると、ルートが返した日程で removeSchedule が呼ばれる", async () => {
    const result = await useCase.execute(base);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.scheduleId).toBe(SCHEDULE_ID);
    expect(port.removedSchedules.map((s) => s.id.toString())).toEqual([SCHEDULE_ID]);
    expect(port.recruitments[0].schedules).toHaveLength(0);
  });

  // ---- エラーケース ----

  it.each([
    ["INVALID_ACCOUNT_ID", { accountId: "not-a-uuid" }],
    ["INVALID_RECRUITMENT_ID", { recruitmentId: "not-a-uuid" }],
    ["INVALID_SCHEDULE_ID", { scheduleId: "not-a-uuid" }],
    ["RECRUITMENT_NOT_FOUND", { recruitmentId: MISSING_ID }],
    ["NOT_OWNER", { accountId: OTHER_ACCOUNT_ID }],
    ["SCHEDULE_NOT_FOUND", { scheduleId: MISSING_ID }],
  ] as const)("%s を返し、何も削除しない", async (type, override) => {
    const result = await useCase.execute({ ...base, ...override });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe(type);
    expect(port.hasWrites).toBe(false);
  });
});
