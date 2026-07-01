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
  ForceUnpublishProjectUseCase,
  PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE,
} from "../ForceUnpublishProjectUseCase";
import type { ForceUnpublishProjectPort } from "../ports/ForceUnpublishProjectPort";
import type { AdminReviewer } from "../../shared/AdminReviewer";
import type { CreateProjectOutboxMessageParams } from "../ports/RequestPublishPort";

// ==================== テストヘルパー ====================

const OWNER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000001";
const REVIEWER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000099";
const PROJECT_ID_STR = "00000000-0000-4000-b000-000000000001";

function createOwnerAccountId(): AccountId {
  const r = AccountId.from(OWNER_ACCOUNT_ID_STR);
  if (!r.ok) throw new Error("fixture: AccountId creation failed");
  return r.value;
}

function createProjectId(): ProjectId {
  const r = ProjectId.from(PROJECT_ID_STR);
  if (!r.ok) throw new Error("fixture: ProjectId creation failed");
  return r.value;
}

function createEmptySnsLinks(): SnsLinks {
  const r = SnsLinks.create({});
  if (!r.ok) throw new Error("fixture: SnsLinks creation failed");
  return r.value;
}

function createTokyoLocation(): ProjectLocation {
  const r = ProjectLocation.create({ prefectureCode: "13" });
  if (!r.ok) throw new Error("fixture: ProjectLocation creation failed");
  return r.value;
}

/**
 * 指定した publishStatus の Project を生成する。
 *
 * 公開必須項目はすべて満たしている。
 */
function createProjectWithStatus(publishStatus: PublishStatus): Project {
  return Project.reconstruct({
    id: createProjectId(),
    ownerAccountId: createOwnerAccountId(),
    title: "古民家再生プロジェクト",
    coverImageUrl: "https://example.com/cover.jpg",
    category: "FOOD",
    location: createTokyoLocation(),
    phase: ProjectPhase.VISION,
    publishStatus,
    summary: "築100年の古民家を再生する",
    body: "想いを綴った本文",
    leaderIntroduction: "リーダー紹介",
    snsLinks: createEmptySnsLinks(),
    activityPlan: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  });
}

// ==================== インメモリ実装 ====================

class InMemoryForceUnpublishProjectPort implements ForceUnpublishProjectPort {
  projects: Project[] = [];
  adminReviewers: AdminReviewer[] = [];
  savedProjects: Project[] = [];
  savedFeedbacks: ProjectReviewFeedback[] = [];
  createdOutboxMessages: CreateProjectOutboxMessageParams[] = [];
  executeInTransactionCallCount = 0;

  async findAdminReviewerById(id: string): Promise<AdminReviewer | null> {
    return this.adminReviewers.find((r) => r.id === id) ?? null;
  }

  async findProjectById(projectId: string): Promise<Project | null> {
    return this.projects.find((p) => p.id.toString() === projectId) ?? null;
  }

  async executeForceUnpublishInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void> {
    this.executeInTransactionCallCount += 1;
    this.savedProjects.push(params.project);
    this.savedFeedbacks.push(params.reviewFeedback);
    this.createdOutboxMessages.push(params.outboxMessage);
  }
}

// ==================== テスト ====================

describe("ForceUnpublishProjectUseCase", () => {
  let port: InMemoryForceUnpublishProjectPort;
  let useCase: ForceUnpublishProjectUseCase;

  beforeEach(() => {
    port = new InMemoryForceUnpublishProjectPort();
    // デフォルトで ACTIVE な AdminAccount reviewer を登録（正常系で使う）
    port.adminReviewers.push({
      id: REVIEWER_ACCOUNT_ID_STR,
      email: "admin@example.com",
    });
    useCase = new ForceUnpublishProjectUseCase(port);
  });

  // ---- ハッピーパス ----

  it("PUBLISHED の強制非公開で DRAFT に遷移し projectId が返る", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "不適切なコンテンツのため強制非公開",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.projectId).toBe(PROJECT_ID_STR);
    expect(port.executeInTransactionCallCount).toBe(1);
    expect(port.savedProjects).toHaveLength(1);
    expect(port.savedProjects[0].publishStatus).toBe(PublishStatus.DRAFT);
  });

  it("ProjectReviewFeedback が FORCE_UNPUBLISHED / reviewerId / reviewerNote で記録される", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "コンテンツ違反",
    });

    expect(result.ok).toBe(true);
    expect(port.savedFeedbacks).toHaveLength(1);

    const fb = port.savedFeedbacks[0];
    expect(fb.action).toBe(ReviewAction.FORCE_UNPUBLISHED);
    expect(fb.projectId.toString()).toBe(PROJECT_ID_STR);
    expect(fb.reviewerId.toString()).toBe(REVIEWER_ACCOUNT_ID_STR);
    expect(fb.note).toBe("コンテンツ違反");
  });

  it("Outbox メッセージの type / payload が正しく生成される", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "  ガイドライン違反のため  ",
    });

    expect(result.ok).toBe(true);
    expect(port.createdOutboxMessages).toHaveLength(1);

    const outbox = port.createdOutboxMessages[0];
    // id は UUID v4
    expect(outbox.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(outbox.type).toBe(PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE);

    const payload = outbox.payload as {
      projectId: string;
      projectTitle: string;
      leaderAccountId: string;
      reviewerId: string;
      reviewerNote: string;
      unpublishedAt: string;
    };
    expect(payload.projectId).toBe(PROJECT_ID_STR);
    expect(payload.projectTitle).toBe("古民家再生プロジェクト");
    expect(payload.leaderAccountId).toBe(OWNER_ACCOUNT_ID_STR);
    expect(payload.reviewerId).toBe(REVIEWER_ACCOUNT_ID_STR);
    // ProjectReviewFeedback 内部で trim されるので ReviewFeedback.note と一致する想定
    expect(payload.reviewerNote).toBe("ガイドライン違反のため");
    expect(typeof payload.unpublishedAt).toBe("string");
    expect(new Date(payload.unpublishedAt).toISOString()).toBe(payload.unpublishedAt);
  });

  // ---- reviewerNote 必須 ----

  it("reviewerNote が空文字列のとき REVIEWER_NOTE_REQUIRED", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOTE_REQUIRED");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  it("reviewerNote が空白のみのとき REVIEWER_NOTE_REQUIRED", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "    \u3000  ",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOTE_REQUIRED");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  // ---- 入力バリデーション ----

  it("不正な reviewerId 形式で INVALID_REVIEWER_ID", async () => {
    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: "not-a-uuid",
      reviewerNote: "理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_REVIEWER_ID");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  it("不正な projectId 形式で INVALID_PROJECT_ID", async () => {
    const result = await useCase.execute({
      projectId: "not-a-uuid",
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_ID");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  // ---- ProjectNotFound ----

  it("存在しないプロジェクト ID で PROJECT_NOT_FOUND", async () => {
    const result = await useCase.execute({
      projectId: "00000000-0000-4000-b000-000000000099",
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("PROJECT_NOT_FOUND");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  // ---- 状態遷移エラー (InvalidProjectStatus) ----

  it("DRAFT 状態で強制非公開を試みると DOMAIN_ERROR (CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED)", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.DRAFT));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("DOMAIN_ERROR");
    if (result.error.type !== "DOMAIN_ERROR") return;
    expect(result.error.domainError.type).toBe("CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED");
    if (result.error.domainError.type === "CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED") {
      expect(result.error.domainError.currentStatus).toBe(PublishStatus.DRAFT);
    }
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  it("PENDING_REVIEW 状態で強制非公開を試みると DOMAIN_ERROR (CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED)", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PENDING_REVIEW));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("DOMAIN_ERROR");
    if (result.error.type !== "DOMAIN_ERROR") return;
    expect(result.error.domainError.type).toBe("CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED");
    if (result.error.domainError.type === "CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED") {
      expect(result.error.domainError.currentStatus).toBe(PublishStatus.PENDING_REVIEW);
    }
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  // ---- reviewer (AdminAccount) 二重防御 ----

  it("reviewer (AdminAccount) が存在しない場合 REVIEWER_NOT_FOUND を返す", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));
    // デフォルト登録された AdminReviewer を取り除いて unknown reviewer を再現
    port.adminReviewers = [];

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOT_FOUND");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  it("AdminAccount が無効化済み（adapter が null 返却）の場合 REVIEWER_NOT_FOUND を返す", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));
    // adapter 層で status !== "ACTIVE" の AdminAccount は null にマップされる想定。
    port.adminReviewers = [];

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "理由",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOT_FOUND");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  // ---- reviewerNote 追加バリデーション ----

  it("reviewerNote がタブ/改行のみの場合 REVIEWER_NOTE_REQUIRED", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "\t\n\r",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOTE_REQUIRED");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  it("reviewerNote が上限 2000 文字を超えると REVIEWER_NOTE_TOO_LONG", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "a".repeat(2001),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("REVIEWER_NOTE_TOO_LONG");
    if (result.error.type !== "REVIEWER_NOTE_TOO_LONG") return;
    expect(result.error.maxLength).toBe(2000);
    expect(result.error.actualLength).toBe(2001);
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  // ---- Outbox payload 型保証 ----

  it("Outbox payload.reviewerNote は trim 済み string 型である（string | null にならない）", async () => {
    port.projects.push(createProjectWithStatus(PublishStatus.PUBLISHED));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      reviewerId: REVIEWER_ACCOUNT_ID_STR,
      reviewerNote: "  違反内容  ",
    });

    expect(result.ok).toBe(true);

    const payload = port.createdOutboxMessages[0].payload as {
      reviewerNote: string;
    };
    // 型レベル: string のみを受け入れる変数に代入できることで string 型であることを保証
    const reviewerNoteAsString: string = payload.reviewerNote;
    expect(reviewerNoteAsString).toBe("違反内容");
    expect(typeof reviewerNoteAsString).toBe("string");
  });
});
