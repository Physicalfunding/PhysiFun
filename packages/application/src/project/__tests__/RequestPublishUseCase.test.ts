import { describe, it, expect, beforeEach } from "@jest/globals";
import { AccountId, Project, ProjectLocation, ProjectPhase, SnsLinks } from "@physifun/domain";
import { RequestPublishUseCase } from "../RequestPublishUseCase";
import type {
  RequestPublishPort,
  CreateProjectOutboxMessageParams,
} from "../ports/RequestPublishPort";

// ==================== テストヘルパー ====================

// 有効な UUID v4
const ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000001";
const OTHER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000002";

function validLocation(): ProjectLocation {
  const r = ProjectLocation.create({ prefectureCode: "13" });
  if (!r.ok) throw new Error("fixture broken");
  return r.value;
}

function emptySns(): SnsLinks {
  const r = SnsLinks.create({});
  if (!r.ok) throw new Error("fixture broken");
  return r.value;
}

/** 公開時必須項目を全て満たした DRAFT プロジェクトを作成する */
function createFullDraft(ownerAccountId: AccountId, title = "古民家再生プロジェクト"): Project {
  const result = Project.createDraft({ ownerAccountId, title });
  if (!result.ok) throw new Error("createDraft failed in fixture");
  const project = result.value;
  const updateResult = project.update({
    coverImageUrl: "https://example.com/image.jpg",
    category: "FOOD",
    location: validLocation(),
    phase: ProjectPhase.VISION,
    summary: "築100年の古民家を再生する",
    body: "# 想い\n古民家に込められた歴史を次世代に繋ぎたい",
    leaderIntroduction: "リーダーの紹介文",
    snsLinks: emptySns(),
  });
  if (!updateResult.ok) throw new Error("fixture update failed");
  return project;
}

/** 必須項目が欠けた DRAFT プロジェクトを作成する（coverImageUrl 欠落） */
function createIncompleteDraft(ownerAccountId: AccountId): Project {
  const result = Project.createDraft({ ownerAccountId, title: "未完成プロジェクト" });
  if (!result.ok) throw new Error("createDraft failed in fixture");
  return result.value; // coverImageUrl 等が null の状態
}

// ==================== インメモリ実装 ====================

class InMemoryRequestPublishPort implements RequestPublishPort {
  /** 保存済みプロジェクト（findProjectById 用） */
  projects: Project[] = [];

  /** executeInTransaction で保存された Project */
  savedProjects: Project[] = [];

  /** executeInTransaction で記録された Outbox メッセージ */
  createdOutboxMessages: CreateProjectOutboxMessageParams[] = [];

  /** executeInTransaction の呼び出し回数 */
  executeInTransactionCallCount = 0;

  async findProjectById(projectId: string): Promise<Project | null> {
    return this.projects.find((p) => p.id.toString() === projectId) ?? null;
  }

  async executeInTransaction(params: {
    project: Project;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void> {
    this.executeInTransactionCallCount += 1;
    this.savedProjects.push(params.project);
    this.createdOutboxMessages.push(params.outboxMessage);
  }
}

// ==================== テスト ====================

describe("RequestPublishUseCase", () => {
  let port: InMemoryRequestPublishPort;
  let useCase: RequestPublishUseCase;
  let ownerAccountId: AccountId;

  beforeEach(() => {
    port = new InMemoryRequestPublishPort();
    useCase = new RequestPublishUseCase(port);
    const parsed = AccountId.from(ACCOUNT_ID_STR);
    if (!parsed.ok) throw new Error("unreachable");
    ownerAccountId = parsed.value;
  });

  // ---- ハッピーパス ----

  it("有効な入力で DRAFT → PENDING_REVIEW に遷移し、projectId が返る", async () => {
    const project = createFullDraft(ownerAccountId);
    port.projects.push(project);

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      projectId: project.id.toString(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.projectId).toBe(project.id.toString());
    expect(project.publishStatus).toBe("PENDING_REVIEW");
  });

  it("executeInTransaction が 1 回呼ばれ、プロジェクトと Outbox が同一トランザクションで保存される", async () => {
    const project = createFullDraft(ownerAccountId);
    port.projects.push(project);

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      projectId: project.id.toString(),
    });

    expect(result.ok).toBe(true);
    expect(port.executeInTransactionCallCount).toBe(1);
    expect(port.savedProjects).toHaveLength(1);
    expect(port.savedProjects[0].id.toString()).toBe(project.id.toString());
    expect(port.savedProjects[0].publishStatus).toBe("PENDING_REVIEW");
    expect(port.createdOutboxMessages).toHaveLength(1);
  });

  it("Outbox メッセージの type と payload が正しい", async () => {
    const project = createFullDraft(ownerAccountId, "素敵なプロジェクト");
    port.projects.push(project);

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      projectId: project.id.toString(),
    });

    expect(result.ok).toBe(true);
    expect(port.createdOutboxMessages).toHaveLength(1);
    const outbox = port.createdOutboxMessages[0];

    // id は UUID v4
    expect(outbox.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    // type は admin_publish_request.notify（運営への公開申請通知）
    expect(outbox.type).toBe("admin_publish_request.notify");

    const payload = outbox.payload as {
      projectId: string;
      projectTitle: string;
      leaderAccountId: string;
      requestedAt: string;
    };
    expect(payload.projectId).toBe(project.id.toString());
    expect(payload.projectTitle).toBe("素敵なプロジェクト");
    expect(payload.leaderAccountId).toBe(ACCOUNT_ID_STR);
    // requestedAt は ISO8601 文字列
    expect(typeof payload.requestedAt).toBe("string");
    expect(() => new Date(payload.requestedAt)).not.toThrow();
    expect(new Date(payload.requestedAt).toISOString()).toBe(payload.requestedAt);
  });

  // ---- バリデーションエラー ----

  it("無効な accountId 形式は INVALID_ACCOUNT_ID", async () => {
    const result = await useCase.execute({
      accountId: "not-a-uuid",
      projectId: "00000000-0000-4000-a000-000000000001",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_ACCOUNT_ID");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  it("無効な projectId 形式は INVALID_PROJECT_ID", async () => {
    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      projectId: "not-a-uuid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_ID");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  // ---- 存在しないプロジェクト ----

  it("プロジェクトが見つからない場合は PROJECT_NOT_FOUND", async () => {
    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      projectId: "99999999-9999-4999-a999-999999999999",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("PROJECT_NOT_FOUND");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  // ---- オーナー以外 ----

  it("オーナー以外が公開申請すると NOT_OWNER", async () => {
    const project = createFullDraft(ownerAccountId);
    port.projects.push(project);

    const result = await useCase.execute({
      accountId: OTHER_ACCOUNT_ID_STR,
      projectId: project.id.toString(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("NOT_OWNER");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  // ---- ドメインエラー: 必須項目不足 ----

  it("必須項目（coverImageUrl など）が欠けている場合は DOMAIN_ERROR (PUBLICATION_REQUIREMENTS_NOT_MET)", async () => {
    const project = createIncompleteDraft(ownerAccountId);
    port.projects.push(project);

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      projectId: project.id.toString(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("DOMAIN_ERROR");
    if (result.error.type !== "DOMAIN_ERROR") return;
    expect(result.error.domainError.type).toBe("PUBLICATION_REQUIREMENTS_NOT_MET");
    expect(port.executeInTransactionCallCount).toBe(0);
  });

  // ---- ドメインエラー: 非 DRAFT ----

  it("既に PENDING_REVIEW のプロジェクトに公開申請すると DOMAIN_ERROR (CANNOT_REQUEST_PUBLISH_NON_DRAFT)", async () => {
    const project = createFullDraft(ownerAccountId);
    // 先に PENDING_REVIEW に遷移させておく
    const first = project.requestPublish();
    expect(first.ok).toBe(true);
    port.projects.push(project);

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      projectId: project.id.toString(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("DOMAIN_ERROR");
    if (result.error.type !== "DOMAIN_ERROR") return;
    expect(result.error.domainError.type).toBe("CANNOT_REQUEST_PUBLISH_NON_DRAFT");
    expect(port.executeInTransactionCallCount).toBe(0);
  });
});
