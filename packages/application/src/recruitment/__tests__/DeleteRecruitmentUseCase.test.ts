import { describe, it, expect, beforeEach } from "vitest";
import { DeleteRecruitmentUseCase } from "../DeleteRecruitmentUseCase";
import {
  InMemoryRecruitmentPort,
  MISSING_ID,
  OTHER_ACCOUNT_ID,
  OWNER_ACCOUNT_ID,
  RECRUITMENT_ID,
  createRecruitment,
  createSchedule,
} from "./fixtures";

describe("DeleteRecruitmentUseCase", () => {
  let port: InMemoryRecruitmentPort;
  let useCase: DeleteRecruitmentUseCase;

  beforeEach(() => {
    port = new InMemoryRecruitmentPort();
    port.recruitments.push(createRecruitment([createSchedule()]));
    useCase = new DeleteRecruitmentUseCase(port);
  });

  // ---- ハッピーパス ----

  it("所有者が削除すると、募集の ID で delete が呼ばれる", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      recruitmentId: RECRUITMENT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.recruitmentId).toBe(RECRUITMENT_ID);
    expect(port.deleted.map((id) => id.toString())).toEqual([RECRUITMENT_ID]);
  });

  // ---- エラーケース ----

  it("不正な accountId 形式で INVALID_ACCOUNT_ID", async () => {
    const result = await useCase.execute({
      accountId: "not-a-uuid",
      recruitmentId: RECRUITMENT_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_ACCOUNT_ID");
    expect(port.hasWrites).toBe(false);
  });

  it("不正な recruitmentId 形式で INVALID_RECRUITMENT_ID", async () => {
    const result = await useCase.execute({ accountId: OWNER_ACCOUNT_ID, recruitmentId: "x" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_RECRUITMENT_ID");
    expect(port.hasWrites).toBe(false);
  });

  it("募集が存在しないと RECRUITMENT_NOT_FOUND", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      recruitmentId: MISSING_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("RECRUITMENT_NOT_FOUND");
    expect(port.hasWrites).toBe(false);
  });

  it("他人のプロジェクトの募集は削除できない（NOT_OWNER）", async () => {
    const result = await useCase.execute({
      accountId: OTHER_ACCOUNT_ID,
      recruitmentId: RECRUITMENT_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("NOT_OWNER");
    expect(port.hasWrites).toBe(false);
  });
});
