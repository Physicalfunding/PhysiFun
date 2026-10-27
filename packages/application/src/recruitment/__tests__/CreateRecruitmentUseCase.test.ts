import { describe, it, expect, beforeEach } from "vitest";
import { RecruitmentType } from "@physifun/domain";
import { CreateRecruitmentUseCase } from "../CreateRecruitmentUseCase";
import {
  InMemoryRecruitmentPort,
  MISSING_ID,
  OTHER_ACCOUNT_ID,
  OWNER_ACCOUNT_ID,
  PROJECT_ID,
} from "./fixtures";

describe("CreateRecruitmentUseCase", () => {
  let port: InMemoryRecruitmentPort;
  let useCase: CreateRecruitmentUseCase;

  beforeEach(() => {
    port = new InMemoryRecruitmentPort();
    useCase = new CreateRecruitmentUseCase(port);
  });

  const validInput = {
    accountId: OWNER_ACCOUNT_ID,
    projectId: PROJECT_ID,
    title: "  畑の草刈り  ",
    description: "一緒に草刈りをしてくれる人を募集します",
  };

  // ---- ハッピーパス ----

  it("所有者が作成すると recruitmentId が返り、ACTIVITY の募集が保存される", async () => {
    const result = await useCase.execute(validInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(port.created).toHaveLength(1);
    const saved = port.created[0];
    expect(result.value.recruitmentId).toBe(saved.id.toString());
    expect(saved.projectId.toString()).toBe(PROJECT_ID);
    expect(saved.type).toBe(RecruitmentType.ACTIVITY);
    expect(saved.title).toBe("畑の草刈り");
    expect(saved.schedules).toHaveLength(0);
  });

  // ---- エラーケース ----

  it("不正な accountId 形式で INVALID_ACCOUNT_ID", async () => {
    const result = await useCase.execute({ ...validInput, accountId: "not-a-uuid" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_ACCOUNT_ID");
    expect(port.hasWrites).toBe(false);
  });

  it("不正な projectId 形式で INVALID_PROJECT_ID", async () => {
    const result = await useCase.execute({ ...validInput, projectId: "not-a-uuid" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_ID");
    expect(port.hasWrites).toBe(false);
  });

  it("プロジェクトが存在しないと PROJECT_NOT_FOUND", async () => {
    const result = await useCase.execute({ ...validInput, projectId: MISSING_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("PROJECT_NOT_FOUND");
    expect(port.hasWrites).toBe(false);
  });

  it("他人のプロジェクトには作成できない（NOT_OWNER）", async () => {
    const result = await useCase.execute({ ...validInput, accountId: OTHER_ACCOUNT_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("NOT_OWNER");
    expect(port.hasWrites).toBe(false);
  });

  it("タイトルが空だと DOMAIN_ERROR（TITLE_REQUIRED）", async () => {
    const result = await useCase.execute({ ...validInput, title: "   " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "DOMAIN_ERROR", domainError: { type: "TITLE_REQUIRED" } });
    expect(port.hasWrites).toBe(false);
  });

  it("説明が空だと DOMAIN_ERROR（DESCRIPTION_REQUIRED）", async () => {
    const result = await useCase.execute({ ...validInput, description: "" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      type: "DOMAIN_ERROR",
      domainError: { type: "DESCRIPTION_REQUIRED" },
    });
    expect(port.hasWrites).toBe(false);
  });
});
