import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  ApproveLeaderApplicationUseCase,
  MaxProjectsReachedError,
} from "../ApproveLeaderApplicationUseCase";
import type {
  ApproveLeaderApplicationPort,
  AccountForApproval,
} from "../ports/ApproveLeaderApplicationPort";
import type { AdminReviewer } from "../../shared/AdminReviewer";
import {
  LeaderApplication,
  LeaderApplicationId,
  LeaderApplicationStatus,
  ProjectDraft,
  ProjectLocation,
  ProjectPhase,
  PublishStatus,
  SnsLinks,
  AccountId,
} from "@physifun/domain";

// ==================== テストヘルパー ====================

/** テスト用の最小限の ProjectDraft を生成 */
function createTestProjectDraft(overrides?: { activityContent?: string | null }): ProjectDraft {
  const location = ProjectLocation.create({ prefectureCode: "13", municipality: "渋谷区" });
  if (!location.ok) throw new Error("ProjectLocation creation failed");

  const snsLinks = SnsLinks.create({ x: "https://x.com/test" });
  if (!snsLinks.ok) throw new Error("SnsLinks creation failed");

  const draft = ProjectDraft.create({
    projectTitle: "テストプロジェクト",
    projectSummary: "テストプロジェクトの概要です。これはテスト用のサマリーです。",
    projectStory:
      "テストプロジェクトのストーリーです。これはテスト用のストーリーで、十分な長さが必要です。テストプロジェクトのストーリーです。",
    projectCategory: "EVENT",
    location: location.value,
    activityContent:
      overrides?.activityContent === undefined
        ? "テスト活動内容です。これはテスト用の活動計画です。"
        : overrides.activityContent,
    snsLinks: snsLinks.value,
  });
  if (!draft.ok) throw new Error("ProjectDraft creation failed");

  return draft.value;
}

// テスト用の固定 UUID
const APP_ID_STR = "00000000-0000-4000-a000-000000000001";
const ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000002";
const REVIEWER_ID_STR = "00000000-0000-4000-a000-000000000003";

/** PENDING 状態のリーダー応募エンティティを生成 */
function pendingApplication(overrides?: {
  id?: string;
  accountId?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  progress?: ProjectPhase;
  activityContent?: string | null;
}): LeaderApplication {
  const idResult = LeaderApplicationId.from(overrides?.id ?? APP_ID_STR);
  if (!idResult.ok) throw new Error("LeaderApplicationId creation failed");

  const accountIdResult = AccountId.from(overrides?.accountId ?? ACCOUNT_ID_STR);
  if (!accountIdResult.ok) throw new Error("AccountId creation failed");

  const status = overrides?.status ?? LeaderApplicationStatus.PENDING;

  return LeaderApplication.reconstruct({
    id: idResult.value,
    accountId: accountIdResult.value,
    status,
    projectDraft: createTestProjectDraft({ activityContent: overrides?.activityContent }),
    progress: overrides?.progress ?? ProjectPhase.PLANNING,
    submittedAt: new Date("2025-01-01T00:00:00Z"),
    reviewedAt:
      status !== LeaderApplicationStatus.PENDING ? new Date("2025-01-02T00:00:00Z") : null,
    reviewerNote: null,
  });
}

/** SUPPORTER ロールのみのアカウント */
function supporterAccount(overrides?: Partial<AccountForApproval>): AccountForApproval {
  return {
    id: ACCOUNT_ID_STR,
    status: "PENDING_EMAIL_CONFIRMATION",
    roles: ["SUPPORTER"],
    email: "leader@example.com",
    ...overrides,
  };
}

// ==================== インメモリ実装 ====================

/**
 * テスト用のインメモリポート実装
 */
class InMemoryApproveLeaderApplicationPort implements ApproveLeaderApplicationPort {
  /** 保存済みリーダー応募 */
  applications: LeaderApplication[] = [];

  /** 保存済みアカウント（応募者のみ。reviewer は AdminAccount として別管理） */
  accounts: AccountForApproval[] = [];

  /** 保存済み AdminAccount reviewer */
  adminReviewers: AdminReviewer[] = [];

  /** executeApproval で渡されたパラメータを記録 */
  approvalParams: Parameters<ApproveLeaderApplicationPort["executeApproval"]>[0][] = [];

  /** 既存 Project 件数（同一 leader）— count >= maxProjectsPerLeader で MaxProjectsReachedError をスロー */
  existingProjectCount = 0;

  async findApplicationById(id: string): Promise<LeaderApplication | null> {
    return this.applications.find((a) => a.id.toString() === id) ?? null;
  }

  async findAccountById(accountId: string): Promise<AccountForApproval | null> {
    return this.accounts.find((a) => a.id === accountId) ?? null;
  }

  async findAdminReviewerById(id: string): Promise<AdminReviewer | null> {
    return this.adminReviewers.find((r) => r.id === id) ?? null;
  }

  async executeApproval(
    params: Parameters<ApproveLeaderApplicationPort["executeApproval"]>[0]
  ): Promise<void> {
    if (this.existingProjectCount >= params.maxProjectsPerLeader) {
      throw new MaxProjectsReachedError();
    }
    this.approvalParams.push(params);
  }
}

// ==================== テスト ====================

describe("ApproveLeaderApplicationUseCase", () => {
  let port: InMemoryApproveLeaderApplicationPort;
  let useCase: ApproveLeaderApplicationUseCase;

  beforeEach(() => {
    port = new InMemoryApproveLeaderApplicationPort();
    port.adminReviewers.push({ id: REVIEWER_ID_STR, email: "admin@example.com" });
    useCase = new ApproveLeaderApplicationUseCase(port);
  });

  // ---- ハッピーパス ----

  it("PENDING 応募を承認すると applicationId / accountId / projectId が返る", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.applicationId).toBe(APP_ID_STR);
    expect(result.value.accountId).toBe(ACCOUNT_ID_STR);
    expect(result.value.projectId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("executeApproval が正しいパラメータで呼ばれる", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    expect(port.approvalParams).toHaveLength(1);
    const params = port.approvalParams[0];
    expect(params.application.id.toString()).toBe(APP_ID_STR);
    expect(params.accountId).toBe(ACCOUNT_ID_STR);
    expect(params.newRoles).toEqual(["SUPPORTER", "LEADER"]);
    expect(params.reviewedAt).toBeInstanceOf(Date);
    expect(params.project).toBeDefined();
  });

  it("Account.roles に LEADER が追加される（既存ロール維持）", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ roles: ["SUPPORTER"] }));

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    const params = port.approvalParams[0];
    expect(params.newRoles).toEqual(["SUPPORTER", "LEADER"]);
  });

  it("PENDING_EMAIL_CONFIRMATION のアカウントでも承認可能", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ status: "PENDING_EMAIL_CONFIRMATION" }));

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(true);
  });

  it("ACTIVE のアカウントでも承認可能", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ status: "ACTIVE" }));

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(true);
  });

  // ---- Project 自動生成（Issue #192 PR5） ----

  it("承認時に DRAFT の Project が 1 件作成される", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    const project = port.approvalParams[0].project;
    expect(project.publishStatus).toBe(PublishStatus.DRAFT);
  });

  it("Project の各フィールドが LeaderApplication 由来で正しくマップされる", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    const project = port.approvalParams[0].project;
    expect(project.ownerAccountId.toString()).toBe(ACCOUNT_ID_STR);
    expect(project.title).toBe("テストプロジェクト");
    expect(project.summary).toBe("テストプロジェクトの概要です。これはテスト用のサマリーです。");
    expect(project.body).toContain("テストプロジェクトのストーリー");
    expect(project.category).toBe("EVENT");
    expect(project.location?.prefectureCode).toBe("13");
    expect(project.location?.municipality).toBe("渋谷区");
    expect(project.coverImageUrl).toBeNull();
    expect(project.leaderIntroduction).toBeNull();
    expect(project.snsLinks.x).toBe("https://x.com/test");
  });

  it("progress がそのまま Project.phase にコピーされる", async () => {
    port.applications.push(pendingApplication({ progress: ProjectPhase.READY }));
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    expect(port.approvalParams[0].project.phase).toBe(ProjectPhase.READY);
  });

  it("activityContent あり → Project.activityPlan にマップ", async () => {
    port.applications.push(pendingApplication({ activityContent: "毎週末ワークショップ開催" }));
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    expect(port.approvalParams[0].project.activityPlan).toBe("毎週末ワークショップ開催");
  });

  it("activityContent なし（SKILL_ITEM 単独想定）→ Project.activityPlan は null", async () => {
    port.applications.push(pendingApplication({ activityContent: null }));
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    expect(port.approvalParams[0].project.activityPlan).toBeNull();
  });

  // ---- Outbox メッセージ ----

  it("Outbox メッセージの type が approved.notify_applicant", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    const outbox = port.approvalParams[0].outboxMessage;
    expect(outbox.type).toBe("approved.notify_applicant");
  });

  it("Outbox メッセージの payload に applicationId, accountId, email, projectId が含まれる", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ email: "leader@example.com" }));

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    const payload = port.approvalParams[0].outboxMessage.payload as {
      applicationId: string;
      accountId: string;
      email: string;
      projectId: string;
    };
    expect(payload.applicationId).toBe(APP_ID_STR);
    expect(payload.accountId).toBe(ACCOUNT_ID_STR);
    expect(payload.email).toBe("leader@example.com");
    // projectId は execute() の結果と一致する
    expect(payload.projectId).toBe(port.approvalParams[0].project.id.toString());
  });

  it("Outbox メッセージの id が UUID 形式", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    const outbox = port.approvalParams[0].outboxMessage;
    expect(outbox.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  // ---- reviewer (AdminAccount) 二重防御 ----

  it("reviewer (AdminAccount) が存在しない場合 REVIEWER_NOT_FOUND", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: "00000000-0000-4000-a000-000000000099",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOT_FOUND");
  });

  it("AdminAccount が無効化済み（adapter が null 返却）の場合 REVIEWER_NOT_FOUND", async () => {
    // adapter 層で status !== "ACTIVE" の AdminAccount は null にマップされる想定。
    // InMemory 実装では reviewer を登録しないことで「無効化済み」相当を再現する。
    port.adminReviewers = [];
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOT_FOUND");
    expect(port.approvalParams).toHaveLength(0);
  });

  it("REVIEWER_NOT_FOUND の場合は早期リターンする（executeApproval が呼ばれない）", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: "00000000-0000-4000-a000-000000000099",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOT_FOUND");
    expect(port.approvalParams).toHaveLength(0);
  });

  it("不正な reviewerId 形式で INVALID_REVIEWER_ID", async () => {
    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: "not-a-uuid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_REVIEWER_ID");
    expect(port.approvalParams).toHaveLength(0);
  });

  // ---- エラーケース ----

  it("存在しない応募 ID で APPLICATION_NOT_FOUND", async () => {
    const result = await useCase.execute({
      applicationId: "00000000-0000-4000-a000-000000000099",
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("APPLICATION_NOT_FOUND");
  });

  it("応募に紐づくアカウントが存在しない場合 ACCOUNT_NOT_FOUND", async () => {
    port.applications.push(pendingApplication());
    // アカウントは追加しない

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("ACCOUNT_NOT_FOUND");
  });

  it("APPROVED 状態の応募を承認しようとすると NOT_PENDING", async () => {
    port.applications.push(pendingApplication({ status: "APPROVED" }));
    port.accounts.push(supporterAccount());

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("NOT_PENDING");
  });

  it("REJECTED 状態の応募を承認しようとすると NOT_PENDING", async () => {
    port.applications.push(pendingApplication({ status: "REJECTED" }));
    port.accounts.push(supporterAccount());

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("NOT_PENDING");
  });

  // ---- 重複承認（Issue #192 PR5: ALREADY_LEADER 撤廃） ----

  it("既に LEADER ロールを持っていても承認は成功し、Project は新規作成される", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ roles: ["SUPPORTER", "LEADER"] }));

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Project は新規作成される
    expect(port.approvalParams).toHaveLength(1);
    expect(port.approvalParams[0].project).toBeDefined();
  });

  it("既に LEADER ロールを持っているアカウントは roles 更新がスキップされる", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ roles: ["SUPPORTER", "LEADER"] }));

    await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    // 既存ロールがそのまま渡される（重複追加なし）
    expect(port.approvalParams[0].newRoles).toEqual(["SUPPORTER", "LEADER"]);
  });

  it("NOT_PENDING の場合は executeApproval が呼ばれない", async () => {
    port.applications.push(pendingApplication({ status: "APPROVED" }));
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: APP_ID_STR, reviewerId: REVIEWER_ID_STR });

    expect(port.approvalParams).toHaveLength(0);
  });

  // ---- wasAlreadyLeader フラグ（M1） ----

  it("初回 LEADER 付与の場合 wasAlreadyLeader=false", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ roles: ["SUPPORTER"] }));

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.wasAlreadyLeader).toBe(false);
  });

  it("既に LEADER ロール保持の場合 wasAlreadyLeader=true", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ roles: ["SUPPORTER", "LEADER"] }));

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.wasAlreadyLeader).toBe(true);
  });

  // ---- MAX_PROJECTS_REACHED（H1） ----

  it("Project 件数上限超過時に MAX_PROJECTS_REACHED を返す", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());
    port.existingProjectCount = 10; // MAX_PROJECTS_PER_LEADER と同値

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("MAX_PROJECTS_REACHED");
    if (result.error.type !== "MAX_PROJECTS_REACHED") return;
    expect(result.error.max).toBe(10);
  });

  it("Project 件数上限未満なら承認は成功する（boundary: count = max-1）", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());
    port.existingProjectCount = 9;

    const result = await useCase.execute({
      applicationId: APP_ID_STR,
      reviewerId: REVIEWER_ID_STR,
    });

    expect(result.ok).toBe(true);
  });
});
