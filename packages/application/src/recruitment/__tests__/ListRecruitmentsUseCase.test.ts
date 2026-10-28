import { describe, it, expect, beforeEach, vi } from "vitest";
import { ListRecruitmentsUseCase } from "../ListRecruitmentsUseCase";
import {
  InMemoryRecruitmentPort,
  MISSING_ID,
  OTHER_ACCOUNT_ID,
  OTHER_RECRUITMENT_ID,
  OWNER_ACCOUNT_ID,
  PROJECT_ID,
  RECRUITMENT_ID,
  SCHEDULE_ID,
  OTHER_SCHEDULE_ID,
  addOthersRecruitment,
  createRecruitment,
  createSchedule,
} from "./fixtures";

describe("ListRecruitmentsUseCase", () => {
  let port: InMemoryRecruitmentPort;
  let useCase: ListRecruitmentsUseCase;

  beforeEach(() => {
    port = new InMemoryRecruitmentPort();
    port.recruitments.push(
      createRecruitment([
        createSchedule({ id: SCHEDULE_ID, date: "2099-01-10" }),
        createSchedule({ id: OTHER_SCHEDULE_ID, date: "2099-01-03" }),
      ])
    );
    addOthersRecruitment(port);
    useCase = new ListRecruitmentsUseCase(port);
  });

  // ---- ハッピーパス ----

  it("所有者には、そのプロジェクトの募集だけを日程ごと返す（日程は日付の古い順）", async () => {
    const result = await useCase.execute({ accountId: OWNER_ACCOUNT_ID, projectId: PROJECT_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.recruitments).toEqual([
      {
        id: RECRUITMENT_ID,
        type: "ACTIVITY",
        title: "畑の草刈り",
        description: "一緒に草刈りをしてくれる人を募集します",
        schedules: [
          {
            id: OTHER_SCHEDULE_ID,
            date: "2099-01-03",
            startTime: "10:00",
            endTime: "15:00",
            capacityPerHour: 5,
            approvalMode: "AUTO",
          },
          {
            id: SCHEDULE_ID,
            date: "2099-01-10",
            startTime: "10:00",
            endTime: "15:00",
            capacityPerHour: 5,
            approvalMode: "AUTO",
          },
        ],
      },
    ]);
    expect(result.value.recruitments.map((r) => r.id)).not.toContain(OTHER_RECRUITMENT_ID);
  });

  it("募集が無ければ空の配列を返す", async () => {
    port.recruitments = [];

    const result = await useCase.execute({ accountId: OWNER_ACCOUNT_ID, projectId: PROJECT_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.recruitments).toEqual([]);
  });

  // ---- エラーケース ----

  it("不正な accountId 形式で INVALID_ACCOUNT_ID", async () => {
    const result = await useCase.execute({ accountId: "not-a-uuid", projectId: PROJECT_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_ACCOUNT_ID");
  });

  it("不正な projectId 形式で INVALID_PROJECT_ID", async () => {
    const result = await useCase.execute({ accountId: OWNER_ACCOUNT_ID, projectId: "x" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_ID");
  });

  it("プロジェクトが存在しないと PROJECT_NOT_FOUND", async () => {
    const result = await useCase.execute({ accountId: OWNER_ACCOUNT_ID, projectId: MISSING_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("PROJECT_NOT_FOUND");
  });

  it("他人のプロジェクトの募集は読めない（NOT_OWNER）。募集は取得しない", async () => {
    const findByProjectId = vi.spyOn(port, "findByProjectId");

    const result = await useCase.execute({ accountId: OTHER_ACCOUNT_ID, projectId: PROJECT_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("NOT_OWNER");
    expect(findByProjectId).not.toHaveBeenCalled();
  });
});
