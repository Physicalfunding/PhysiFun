import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  AccountId,
  Project,
  ProjectId,
  ProjectLocation,
  ProjectPhase,
  ProjectReviewFeedback,
  PublishStatus,
  ReviewAction,
  SnsLinks,
} from "@physifun/domain";
import {
  ApproveProjectPublicationUseCase,
  MAX_PUBLISHED_PROJECTS_PER_OWNER,
  OwnerPublishedLimitExceededError,
  PROJECT_PUBLISH_APPROVED_NOTIFY_TYPE,
} from "../ApproveProjectPublicationUseCase";
import type {
  AccountForProjectApproval,
  ApproveProjectPublicationPort,
} from "../ports/ApproveProjectPublicationPort";
import type { CreateProjectOutboxMessageParams } from "../ports/RequestPublishPort";

// ==================== テストヘルパー ====================

const OWNER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000001";
const REVIEWER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000099";
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
 * 指定した publishStatus の公開必須項目満たし Project を生成する。
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

function createPendingReviewProject(): Project {
  return createProjectWithStatus(PublishStatus.PENDING_REVIEW);
}

// ==================== インメモリ実装 ====================

class InMemoryApproveProjectPublicationPort implements ApproveProjectPublicationPort {
  /**
   * findAccountById の挙動を制御するオーバーライド。
   * - 未設定: デフォルトで ADMIN として扱う
   * - null: アカウント未発見（REVIEWER_NOT_FOUND 検証用）
   * - object: そのロール構成を返す
   */
  accountOverrides = new Map<string, AccountForProjectApproval | null>();

  /** findProjectById が返す候補 */
  projects: Project[] = [];

  /**
   * executeApproveInTransaction 内の count が参照する値。
   * 実際の Prisma 実装では tx 内 count() の結果を使う。
   */
  publishedCountByOwner = new Map<string, number>();

  /** executeApproveInTransaction で保存された Project */
  savedProjects: Project[] = [];

  /** executeApproveInTransaction で受け取った publishedAt */
  savedPublishedAt: Date[] = [];

  /** executeApproveInTransaction で保存された ReviewFeedback */
  savedFeedbacks: ProjectReviewFeedback[] = [];

  /** executeApproveInTransaction で記録された Outbox メッセージ */
  createdOutboxMessages: CreateProjectOutboxMessageParams[] = [];

  /** executeApproveInTransaction 呼び出し回数 */
  executeApproveCallCount = 0;

  async findAccountById(accountId: string): Promise<AccountForProjectApproval | null> {
    if (this.accountOverrides.has(accountId)) {
      return this.accountOverrides.get(accountId) ?? null;
    }
    // デフォルト: ADMIN として扱う
    return { id: accountId, roles: ["ADMIN"] };
  }

  async findProjectById(projectId: string): Promise<Project | null> {
    return this.projects.find((p) => p.id.toString() === projectId) ?? null;
  }

  async executeApproveInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
    publishedAt: Date;
    maxPublishedPerOwner: number;
  }): Promise<void> {
    // 同一 tx 内 count → 上限チェックをシミュレート
    const count = this.publishedCountByOwner.get(params.project.ownerAccountId.toString()) ?? 0;
    if (count >= params.maxPublishedPerOwner) {
      throw new OwnerPublishedLimitExceededError();
    }

    this.executeApproveCallCount += 1;
    this.savedProjects.push(params.project);
    this.savedPublishedAt.push(params.publishedAt);
    this.savedFeedbacks.push(params.reviewFeedback);
    this.createdOutboxMessages.push(params.outboxMessage);
  }
}

// ==================== テスト ====================

describe("ApproveProjectPublicationUseCase", () => {
  let port: InMemoryApproveProjectPublicationPort;
  let useCase: ApproveProjectPublicationUseCase;

  beforeEach(() => {
    port = new InMemoryApproveProjectPublicationPort();
    useCase = new ApproveProjectPublicationUseCase(port);
  });

  // ---- ハッピーパス ----

  it("PENDING_REVIEW の承認で PUBLISHED に遷移し projectId が返る", async () => {
    port.projects.push(createPendingReviewProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.projectId).toBe(PROJECT_ID_STR);
  });

  it("executeApproveInTransaction が 1 回呼ばれ、Project / ReviewFeedback / Outbox が同一 tx で永続化される", async () => {
    port.projects.push(createPendingReviewProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(true);
    expect(port.executeApproveCallCount).toBe(1);
    expect(port.savedProjects).toHaveLength(1);
    expect(port.savedProjects[0].publishStatus).toBe(PublishStatus.PUBLISHED);

    expect(port.savedFeedbacks).toHaveLength(1);
    const feedback = port.savedFeedbacks[0];
    expect(feedback.action).toBe(ReviewAction.APPROVED);
    expect(feedback.reviewerId.toString()).toBe(REVIEWER_ACCOUNT_ID_STR);
    expect(feedback.projectId.toString()).toBe(PROJECT_ID_STR);
    expect(feedback.note).toBeNull();

    expect(port.createdOutboxMessages).toHaveLength(1);
  });

  it("publishedAt と updatedAt は同一の timestamp (project.updatedAt) が渡される", async () => {
    port.projects.push(createPendingReviewProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(true);
    expect(port.savedPublishedAt).toHaveLength(1);
    expect(port.savedProjects[0].updatedAt.getTime()).toBe(port.savedPublishedAt[0].getTime());
  });

  it("Outbox メッセージの type と payload が正しい", async () => {
    port.projects.push(createPendingReviewProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(true);
    const outbox = port.createdOutboxMessages[0];

    expect(outbox.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(outbox.type).toBe(PROJECT_PUBLISH_APPROVED_NOTIFY_TYPE);

    const payload = outbox.payload as {
      projectId: string;
      projectTitle: string;
      leaderAccountId: string;
      reviewerId: string;
      approvedAt: string;
    };
    expect(payload.projectId).toBe(PROJECT_ID_STR);
    expect(payload.projectTitle).toBe("テストプロジェクト");
    expect(payload.leaderAccountId).toBe(OWNER_ACCOUNT_ID_STR);
    expect(payload.reviewerId).toBe(REVIEWER_ACCOUNT_ID_STR);
    expect(typeof payload.approvedAt).toBe("string");
    expect(new Date(payload.approvedAt).toISOString()).toBe(payload.approvedAt);
  });

  // ---- note optional 両パターン ----

  it("note 未指定の場合は ReviewFeedback.note が null になる", async () => {
    port.projects.push(createPendingReviewProject());

    await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(port.savedFeedbacks[0].note).toBeNull();
  });

  it("note 指定ありの場合は ReviewFeedback.note に反映される", async () => {
    port.projects.push(createPendingReviewProject());

    await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      note: "基準を満たしているため承認します",
    });

    expect(port.savedFeedbacks[0].note).toBe("基準を満たしているため承認します");
  });

  // ---- 入力バリデーションエラー ----

  it("不正な projectId 形式で INVALID_PROJECT_ID", async () => {
    const result = await useCase.execute({
      projectId: "not-a-uuid",
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_ID");
    expect(port.executeApproveCallCount).toBe(0);
  });

  it("不正な reviewerId 形式で INVALID_REVIEWER_ID", async () => {
    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: "not-a-uuid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_REVIEWER_ID");
    expect(port.executeApproveCallCount).toBe(0);
  });

  // ---- ADMIN ロール二重防御 ----

  it("審査者アカウントが存在しない場合は REVIEWER_NOT_FOUND", async () => {
    port.accountOverrides.set(REVIEWER_ACCOUNT_ID_STR, null);

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOT_FOUND");
    expect(port.executeApproveCallCount).toBe(0);
  });

  it("審査者が ADMIN ロールを持たない場合は REVIEWER_NOT_ADMIN", async () => {
    port.accountOverrides.set(REVIEWER_ACCOUNT_ID_STR, {
      id: REVIEWER_ACCOUNT_ID_STR,
      roles: ["LEADER"],
    });
    port.projects.push(createPendingReviewProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOT_ADMIN");
    expect(port.executeApproveCallCount).toBe(0);
  });

  // ---- 存在しないプロジェクト ----

  it("プロジェクトが見つからない場合は PROJECT_NOT_FOUND", async () => {
    const result = await useCase.execute({
      projectId: "00000000-0000-4000-b000-000000000099",
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("PROJECT_NOT_FOUND");
    expect(port.executeApproveCallCount).toBe(0);
  });

  // ---- 状態遷移エラー ----

  it("DRAFT 状態の承認は INVALID_PROJECT_STATUS (CANNOT_APPROVE_NON_PENDING)", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.DRAFT));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_STATUS");
    if (result.error.type !== "INVALID_PROJECT_STATUS") return;
    expect(result.error.domainError.type).toBe("CANNOT_APPROVE_NON_PENDING");
    if (result.error.domainError.type === "CANNOT_APPROVE_NON_PENDING") {
      expect(result.error.domainError.currentStatus).toBe(PublishStatus.DRAFT);
    }
    expect(port.executeApproveCallCount).toBe(0);
  });

  it("PUBLISHED 状態の承認は INVALID_PROJECT_STATUS (CANNOT_APPROVE_NON_PENDING)", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_STATUS");
    if (result.error.type !== "INVALID_PROJECT_STATUS") return;
    expect(result.error.domainError.type).toBe("CANNOT_APPROVE_NON_PENDING");
    expect(port.executeApproveCallCount).toBe(0);
  });

  // ---- Case A: PUBLISHED 上限超過（tx 内で throw） ----

  it("同一オーナーが既に 3 件 PUBLISHED の場合は OWNER_PUBLISHED_LIMIT_EXCEEDED", async () => {
    port.projects.push(createPendingReviewProject());
    port.publishedCountByOwner.set(OWNER_ACCOUNT_ID_STR, MAX_PUBLISHED_PROJECTS_PER_OWNER);

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("OWNER_PUBLISHED_LIMIT_EXCEEDED");
    if (result.error.type !== "OWNER_PUBLISHED_LIMIT_EXCEEDED") return;
    expect(result.error.maxCount).toBe(MAX_PUBLISHED_PROJECTS_PER_OWNER);
    // tx 内で throw されるため保存は発生しない
    expect(port.savedProjects).toHaveLength(0);
    expect(port.savedFeedbacks).toHaveLength(0);
    expect(port.createdOutboxMessages).toHaveLength(0);
  });

  it("同一オーナーが 2 件 PUBLISHED の場合は承認できる (境界値)", async () => {
    port.projects.push(createPendingReviewProject());
    port.publishedCountByOwner.set(OWNER_ACCOUNT_ID_STR, MAX_PUBLISHED_PROJECTS_PER_OWNER - 1);

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(true);
    expect(port.executeApproveCallCount).toBe(1);
  });
});
