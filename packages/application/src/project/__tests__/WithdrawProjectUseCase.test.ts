import { describe, it, expect, beforeEach } from "@jest/globals";
import { WithdrawProjectUseCase } from "../WithdrawProjectUseCase";
import type { WithdrawProjectPort } from "../ports/WithdrawProjectPort";
import {
  Project,
  ProjectId,
  ProjectPhase,
  PublishStatus,
  AccountId,
  ProjectLocation,
  SnsLinks,
} from "@physifun/domain";

// ==================== テストヘルパー ====================

const OWNER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000001";
const OTHER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000002";
const PROJECT_ID_STR = "00000000-0000-4000-b000-000000000001";

function createOwnerAccountId(): AccountId {
  const r = AccountId.from(OWNER_ACCOUNT_ID_STR);
  if (!r.ok) throw new Error("AccountId creation failed");
  return r.value;
}

function createProjectId(): ProjectId {
  const r = ProjectId.from(PROJECT_ID_STR);
  if (!r.ok) throw new Error("ProjectId creation failed");
  return r.value;
}

function createEmptySnsLinks(): SnsLinks {
  const r = SnsLinks.create({});
  if (!r.ok) throw new Error("SnsLinks creation failed");
  return r.value;
}

function createTokyoLocation(): ProjectLocation {
  const r = ProjectLocation.create({ prefectureCode: "13" });
  if (!r.ok) throw new Error("ProjectLocation creation failed");
  return r.value;
}

/**
 * 公開必須項目を満たす PENDING_REVIEW 状態の Project を生成する。
 *
 * 公開申請に必要なフィールド: coverImageUrl / category / location /
 * summary / body / leaderIntroduction
 */
function createPendingReviewProject(): Project {
  return Project.reconstruct({
    id: createProjectId(),
    ownerAccountId: createOwnerAccountId(),
    title: "テストプロジェクト",
    coverImageUrl: "https://example.com/cover.jpg",
    category: "KOMINKA",
    location: createTokyoLocation(),
    phase: ProjectPhase.VISION,
    publishStatus: PublishStatus.PENDING_REVIEW,
    summary: "サマリー",
    body: "本文",
    leaderIntroduction: "リーダー紹介",
    snsLinks: createEmptySnsLinks(),
    activityPlan: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  });
}

/**
 * 指定した publishStatus の Project を生成する（PENDING_REVIEW 以外の状態用）。
 */
function createProjectWithStatus(publishStatus: PublishStatus): Project {
  return Project.reconstruct({
    id: createProjectId(),
    ownerAccountId: createOwnerAccountId(),
    title: "テストプロジェクト",
    coverImageUrl: "https://example.com/cover.jpg",
    category: "KOMINKA",
    location: createTokyoLocation(),
    phase: ProjectPhase.VISION,
    publishStatus,
    summary: "サマリー",
    body: "本文",
    leaderIntroduction: "リーダー紹介",
    snsLinks: createEmptySnsLinks(),
    activityPlan: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  });
}

// ==================== インメモリ実装 ====================

/**
 * テスト用インメモリポート。
 *
 * 自主取下げは ReviewFeedback を作成しないため、Port には
 * findProjectById / saveProject の 2 メソッドのみ存在する（他メソッドなし）。
 * これにより「ReviewFeedback 系メソッドが呼ばれない」ことが型レベルで保証される。
 */
class InMemoryWithdrawProjectPort implements WithdrawProjectPort {
  projects: Project[] = [];
  savedProjects: Project[] = [];

  async findProjectById(projectId: string): Promise<Project | null> {
    return this.projects.find((p) => p.id.toString() === projectId) ?? null;
  }

  async saveProject(project: Project): Promise<void> {
    this.savedProjects.push(project);
  }
}

// ==================== テスト ====================

describe("WithdrawProjectUseCase", () => {
  let port: InMemoryWithdrawProjectPort;
  let useCase: WithdrawProjectUseCase;

  beforeEach(() => {
    port = new InMemoryWithdrawProjectPort();
    useCase = new WithdrawProjectUseCase(port);
  });

  // ---- ハッピーパス ----

  it("PENDING_REVIEW の自主取下げで DRAFT に遷移し projectId が返る", async () => {
    port.projects.push(createPendingReviewProject());

    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID_STR,
      projectId: PROJECT_ID_STR,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.projectId).toBe(PROJECT_ID_STR);
  });

  it("saveProject が 1 回だけ呼ばれ、ステータスが DRAFT に変わっている", async () => {
    port.projects.push(createPendingReviewProject());

    await useCase.execute({
      accountId: OWNER_ACCOUNT_ID_STR,
      projectId: PROJECT_ID_STR,
    });

    expect(port.savedProjects).toHaveLength(1);
    expect(port.savedProjects[0].publishStatus).toBe(PublishStatus.DRAFT);
  });

  it("自主取下げでは ReviewFeedback が作成されない（Port に該当メソッド自体が存在しない）", async () => {
    port.projects.push(createPendingReviewProject());

    await useCase.execute({
      accountId: OWNER_ACCOUNT_ID_STR,
      projectId: PROJECT_ID_STR,
    });

    // プロジェクト.md line 76 の仕様: 「自主取下げはフィードバック不要」。
    // Port インターフェース上に ReviewFeedback を扱うメソッドが無いことで、
    // 呼び出しが発生しないことを構造的に保証している。
    const portKeys = Object.keys(port).concat(
      Object.getOwnPropertyNames(Object.getPrototypeOf(port))
    );
    expect(portKeys.some((k) => k.toLowerCase().includes("feedback"))).toBe(false);
  });

  // ---- 入力バリデーションエラー ----

  it("不正な accountId 形式で INVALID_ACCOUNT_ID", async () => {
    port.projects.push(createPendingReviewProject());

    const result = await useCase.execute({
      accountId: "not-a-uuid",
      projectId: PROJECT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("INVALID_ACCOUNT_ID");
    expect(port.savedProjects).toHaveLength(0);
  });

  it("不正な projectId 形式で INVALID_PROJECT_ID", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID_STR,
      projectId: "not-a-uuid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("INVALID_PROJECT_ID");
    expect(port.savedProjects).toHaveLength(0);
  });

  // ---- 権限・存在エラー ----

  it("存在しないプロジェクト ID で PROJECT_NOT_FOUND", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID_STR,
      projectId: "00000000-0000-4000-b000-000000000099",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("PROJECT_NOT_FOUND");
    expect(port.savedProjects).toHaveLength(0);
  });

  it("オーナーでないアカウントで NOT_OWNER", async () => {
    port.projects.push(createPendingReviewProject());

    const result = await useCase.execute({
      accountId: OTHER_ACCOUNT_ID_STR,
      projectId: PROJECT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("NOT_OWNER");
    expect(port.savedProjects).toHaveLength(0);
  });

  // ---- 状態遷移エラー ----

  it("DRAFT 状態で取下げを試みると DOMAIN_ERROR (CANNOT_WITHDRAW_NON_PENDING)", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.DRAFT));

    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID_STR,
      projectId: PROJECT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("DOMAIN_ERROR");
    if (result.error.type !== "DOMAIN_ERROR") return;
    expect(result.error.domainError.type).toBe("CANNOT_WITHDRAW_NON_PENDING");
    expect(port.savedProjects).toHaveLength(0);
  });

  it("PUBLISHED 状態で取下げを試みると DOMAIN_ERROR (CANNOT_WITHDRAW_NON_PENDING)", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID_STR,
      projectId: PROJECT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("DOMAIN_ERROR");
    if (result.error.type !== "DOMAIN_ERROR") return;
    expect(result.error.domainError.type).toBe("CANNOT_WITHDRAW_NON_PENDING");
    expect(port.savedProjects).toHaveLength(0);
  });
});
