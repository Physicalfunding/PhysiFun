import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  AccountId,
  Project,
  ProjectId,
  ProjectLocation,
  ProjectPhase,
  ProjectReviewFeedback,
  PublishStatus,
  REVIEW_FEEDBACK_NOTE_MAX_LENGTH,
  ReviewAction,
  SnsLinks,
} from "@physifun/domain";
import {
  LEADER_PUBLISH_REJECTED_NOTIFY_TYPE,
  RejectProjectPublicationUseCase,
} from "../RejectProjectPublicationUseCase";
import type { RejectProjectPublicationPort } from "../ports/RejectProjectPublicationPort";
import type { CreateProjectOutboxMessageParams } from "../ports/RequestPublishPort";

// ==================== テストヘルパー ====================

const OWNER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000001";
const REVIEWER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000010";
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
 * 指定した publishStatus の Project を生成する。
 */
function createProjectWithStatus(
  publishStatus: PublishStatus,
  title = "テストプロジェクト"
): Project {
  return Project.reconstruct({
    id: createProjectId(),
    ownerAccountId: createOwnerAccountId(),
    title,
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

interface InMemoryAccountRow {
  readonly id: string;
  readonly roles: readonly string[];
}

class InMemoryRejectProjectPublicationPort implements RejectProjectPublicationPort {
  /** 保存済みプロジェクト（findProjectById 用） */
  projects: Project[] = [];

  /**
   * 保存済みアカウント（findAccountById 用）。
   * 明示的にセットされていない場合は「ADMIN ロールを持つ常に見つかるアカウント」として振る舞う。
   */
  accounts: InMemoryAccountRow[] | null = null;

  /** executeRejectInTransaction で保存された Project */
  savedProjects: Project[] = [];

  /** executeRejectInTransaction で記録された ReviewFeedback */
  createdFeedbacks: ProjectReviewFeedback[] = [];

  /** executeRejectInTransaction で記録された Outbox メッセージ */
  createdOutboxMessages: CreateProjectOutboxMessageParams[] = [];

  /** executeRejectInTransaction の呼び出し回数 */
  executeRejectInTransactionCallCount = 0;

  async findAccountById(accountId: string): Promise<InMemoryAccountRow | null> {
    if (this.accounts === null) {
      // デフォルトは ADMIN ロール付きの有効なアカウントとして応答する
      return { id: accountId, roles: ["ADMIN"] };
    }
    return this.accounts.find((a) => a.id === accountId) ?? null;
  }

  async findProjectById(projectId: string): Promise<Project | null> {
    return this.projects.find((p) => p.id.toString() === projectId) ?? null;
  }

  async executeRejectInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void> {
    this.executeRejectInTransactionCallCount += 1;
    this.savedProjects.push(params.project);
    this.createdFeedbacks.push(params.reviewFeedback);
    this.createdOutboxMessages.push(params.outboxMessage);
  }
}

// ==================== テスト ====================

describe("RejectProjectPublicationUseCase", () => {
  let port: InMemoryRejectProjectPublicationPort;
  let useCase: RejectProjectPublicationUseCase;

  beforeEach(() => {
    port = new InMemoryRejectProjectPublicationPort();
    useCase = new RejectProjectPublicationUseCase(port);
  });

  // ---- ハッピーパス ----

  it("PENDING_REVIEW → DRAFT に遷移し、projectId を返す", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "画像の解像度が不足しています",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.projectId).toBe(PROJECT_ID_STR);
    // ドメインオブジェクトは DRAFT に遷移している
    expect(port.savedProjects[0].publishStatus).toBe(PublishStatus.DRAFT);
  });

  it("executeRejectInTransaction が 1 回呼ばれ、Project / Feedback / Outbox の 3 点が同一 tx で永続化される", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "再検討をお願いします",
    });

    expect(result.ok).toBe(true);
    expect(port.executeRejectInTransactionCallCount).toBe(1);
    expect(port.savedProjects).toHaveLength(1);
    expect(port.createdFeedbacks).toHaveLength(1);
    expect(port.createdOutboxMessages).toHaveLength(1);
  });

  it("ReviewFeedback は action=REJECTED / note=reviewerNote / 正しい reviewerId で生成される", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));

    const note = "カテゴリが不適切です";
    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: note,
    });

    expect(result.ok).toBe(true);
    const fb = port.createdFeedbacks[0];
    expect(fb.action).toBe(ReviewAction.REJECTED);
    expect(fb.note).toBe(note);
    expect(fb.reviewerId.toString()).toBe(REVIEWER_ACCOUNT_ID_STR);
    expect(fb.projectId.toString()).toBe(PROJECT_ID_STR);
  });

  it("reviewerNote は trim されて Feedback.note に格納される", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "  前後に空白あり  ",
    });

    expect(result.ok).toBe(true);
    expect(port.createdFeedbacks[0].note).toBe("前後に空白あり");
  });

  it("Outbox メッセージの type と payload が正しい", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW, "素敵なプロジェクト"));

    const note = "詳細を追記してください";
    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: note,
    });

    expect(result.ok).toBe(true);
    const outbox = port.createdOutboxMessages[0];

    // id は UUID v4
    expect(outbox.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(outbox.type).toBe(LEADER_PUBLISH_REJECTED_NOTIFY_TYPE);
    expect(outbox.type).toBe("project_publish_rejected.notify");

    const payload = outbox.payload as {
      projectId: string;
      projectTitle: string;
      leaderAccountId: string;
      reviewerId: string;
      reviewerNote: string;
      rejectedAt: string;
    };
    expect(payload.projectId).toBe(PROJECT_ID_STR);
    expect(payload.projectTitle).toBe("素敵なプロジェクト");
    expect(payload.leaderAccountId).toBe(OWNER_ACCOUNT_ID_STR);
    expect(payload.reviewerId).toBe(REVIEWER_ACCOUNT_ID_STR);
    expect(payload.reviewerNote).toBe(note);
    expect(typeof payload.rejectedAt).toBe("string");
    expect(new Date(payload.rejectedAt).toISOString()).toBe(payload.rejectedAt);
  });

  // ---- REVIEWER_NOTE_REQUIRED ----

  it("reviewerNote が空文字なら REVIEWER_NOTE_REQUIRED（永続化は走らない）", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOTE_REQUIRED");
    expect(port.executeRejectInTransactionCallCount).toBe(0);
  });

  it("reviewerNote が空白のみなら REVIEWER_NOTE_REQUIRED", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "    ",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOTE_REQUIRED");
    expect(port.executeRejectInTransactionCallCount).toBe(0);
  });

  it("reviewerNote がタブ・改行のみなら REVIEWER_NOTE_REQUIRED", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "\t\n  \n\t",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOTE_REQUIRED");
  });

  // ---- PROJECT_NOT_FOUND ----

  it("存在しない projectId で PROJECT_NOT_FOUND", async () => {
    const result = await useCase.execute({
      projectId: "99999999-9999-4999-a999-999999999999",
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "却下理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("PROJECT_NOT_FOUND");
    expect(port.executeRejectInTransactionCallCount).toBe(0);
  });

  // ---- INVALID_PROJECT_STATUS ----

  it("DRAFT 状態のプロジェクトに差戻すと INVALID_PROJECT_STATUS", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.DRAFT));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "却下理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_STATUS");
    if (result.error.type !== "INVALID_PROJECT_STATUS") return;
    expect(result.error.currentStatus).toBe(PublishStatus.DRAFT);
    expect(port.executeRejectInTransactionCallCount).toBe(0);
  });

  it("PUBLISHED 状態のプロジェクトに差戻すと INVALID_PROJECT_STATUS", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "却下理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_STATUS");
    if (result.error.type !== "INVALID_PROJECT_STATUS") return;
    expect(result.error.currentStatus).toBe(PublishStatus.PUBLISHED);
    expect(port.executeRejectInTransactionCallCount).toBe(0);
  });

  // ---- 入力形式エラー ----

  it("不正な reviewerId 形式で INVALID_REVIEWER_ID", async () => {
    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: "not-a-uuid",
      reviewerNote: "却下理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_REVIEWER_ID");
    expect(port.executeRejectInTransactionCallCount).toBe(0);
  });

  it("不正な projectId 形式で INVALID_PROJECT_ID", async () => {
    const result = await useCase.execute({
      projectId: "not-a-uuid",
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "却下理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_ID");
    expect(port.executeRejectInTransactionCallCount).toBe(0);
  });

  // ---- REVIEWER_NOT_FOUND / REVIEWER_NOT_ADMIN（UseCase 層の二重防御） ----

  it("reviewer アカウントが存在しない場合 REVIEWER_NOT_FOUND（永続化は走らない）", async () => {
    port.accounts = []; // 空リスト: 指定 reviewerId は見つからない
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "却下理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOT_FOUND");
    expect(port.executeRejectInTransactionCallCount).toBe(0);
  });

  it("reviewer が ADMIN ロールを持たない場合 REVIEWER_NOT_ADMIN（永続化は走らない）", async () => {
    port.accounts = [{ id: REVIEWER_ACCOUNT_ID_STR, roles: ["LEADER"] }];
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "却下理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOT_ADMIN");
    expect(port.executeRejectInTransactionCallCount).toBe(0);
  });

  // ---- REVIEWER_NOTE_TOO_LONG ----

  it("reviewerNote が最大長を超える場合 REVIEWER_NOTE_TOO_LONG（maxLength 付き）", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));
    const tooLongNote = "a".repeat(REVIEW_FEEDBACK_NOTE_MAX_LENGTH + 1);

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: tooLongNote,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOTE_TOO_LONG");
    if (result.error.type !== "REVIEWER_NOTE_TOO_LONG") return;
    expect(result.error.maxLength).toBe(REVIEW_FEEDBACK_NOTE_MAX_LENGTH);
    expect(result.error.actualLength).toBe(REVIEW_FEEDBACK_NOTE_MAX_LENGTH + 1);
    expect(port.executeRejectInTransactionCallCount).toBe(0);
  });
});
