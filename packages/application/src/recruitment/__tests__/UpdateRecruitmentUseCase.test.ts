import { describe, it, expect, beforeEach } from "vitest";
import { SUPPORT_RECRUITMENT_LIMITS } from "@physifun/domain";
import { UpdateRecruitmentUseCase } from "../UpdateRecruitmentUseCase";
import {
  InMemoryRecruitmentPort,
  MISSING_ID,
  OTHER_ACCOUNT_ID,
  OWNER_ACCOUNT_ID,
  RECRUITMENT_ID,
  createRecruitment,
} from "./fixtures";

describe("UpdateRecruitmentUseCase", () => {
  let port: InMemoryRecruitmentPort;
  let useCase: UpdateRecruitmentUseCase;

  beforeEach(() => {
    port = new InMemoryRecruitmentPort();
    port.recruitments.push(createRecruitment());
    useCase = new UpdateRecruitmentUseCase(port);
  });

  // ---- ハッピーパス ----

  it("所有者が更新すると、指定した項目だけ変わって保存される", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      recruitmentId: RECRUITMENT_ID,
      title: "田植えの手伝い",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.recruitmentId).toBe(RECRUITMENT_ID);
    expect(port.updated).toHaveLength(1);
    expect(port.updated[0].title).toBe("田植えの手伝い");
    expect(port.updated[0].description).toBe("一緒に草刈りをしてくれる人を募集します");
  });

  // ---- エラーケース ----

  it("不正な accountId 形式で INVALID_ACCOUNT_ID", async () => {
    const result = await useCase.execute({
      accountId: "not-a-uuid",
      recruitmentId: RECRUITMENT_ID,
      title: "田植えの手伝い",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_ACCOUNT_ID");
    expect(port.hasWrites).toBe(false);
  });

  it("不正な recruitmentId 形式で INVALID_RECRUITMENT_ID", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      recruitmentId: "not-a-uuid",
      title: "田植えの手伝い",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_RECRUITMENT_ID");
    expect(port.hasWrites).toBe(false);
  });

  it("募集が存在しないと RECRUITMENT_NOT_FOUND", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      recruitmentId: MISSING_ID,
      title: "田植えの手伝い",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("RECRUITMENT_NOT_FOUND");
    expect(port.hasWrites).toBe(false);
  });

  it("募集のプロジェクトの所有者が引けないと RECRUITMENT_NOT_FOUND", async () => {
    port.owners.clear();

    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      recruitmentId: RECRUITMENT_ID,
      title: "田植えの手伝い",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("RECRUITMENT_NOT_FOUND");
    expect(port.hasWrites).toBe(false);
  });

  it("他人のプロジェクトの募集は更新できない（NOT_OWNER）", async () => {
    const result = await useCase.execute({
      accountId: OTHER_ACCOUNT_ID,
      recruitmentId: RECRUITMENT_ID,
      title: "田植えの手伝い",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("NOT_OWNER");
    expect(port.hasWrites).toBe(false);
  });

  it("タイトルが長すぎると DOMAIN_ERROR（TITLE_TOO_LONG）", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      recruitmentId: RECRUITMENT_ID,
      title: "あ".repeat(SUPPORT_RECRUITMENT_LIMITS.title + 1),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("DOMAIN_ERROR");
    if (result.error.type !== "DOMAIN_ERROR") return;
    expect(result.error.domainError.type).toBe("TITLE_TOO_LONG");
    expect(port.hasWrites).toBe(false);
  });
});
