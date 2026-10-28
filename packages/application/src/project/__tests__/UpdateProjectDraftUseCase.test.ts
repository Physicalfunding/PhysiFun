import { describe, it, expect, beforeEach } from "vitest";
import {
  UpdateProjectDraftUseCase,
  type UpdateProjectDraftError,
} from "../UpdateProjectDraftUseCase";
import type { UpdateProjectDraftPort } from "../ports/UpdateProjectDraftPort";
import {
  Project,
  ProjectId,
  ProjectPhase,
  PublishStatus,
  AccountId,
  ProjectLocation,
  SnsLinks,
  ProjectReviewFeedback,
} from "@physifun/domain";

// ==================== テストヘルパー ====================

const OWNER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000001";
const OTHER_ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000002";
const PROJECT_ID_STR = "00000000-0000-4000-b000-000000000001";

/** 文字（装飾つき）の段落だけの文書データ */
function storyDoc(...inlines: unknown[]) {
  return { type: "doc", content: [{ type: "paragraph", content: inlines }] };
}

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

/** テスト用の Project エンティティを生成 */
function createTestProject(overrides?: {
  publishStatus?: PublishStatus;
  title?: string;
  phase?: ProjectPhase;
}): Project {
  return Project.reconstruct({
    id: createProjectId(),
    ownerAccountId: createOwnerAccountId(),
    title: overrides?.title ?? "テストプロジェクト",
    coverImageUrl: null,
    category: null,
    location: null,
    phase: overrides?.phase ?? ProjectPhase.VISION,
    publishStatus: overrides?.publishStatus ?? PublishStatus.DRAFT,
    summary: null,
    body: null,
    leaderIntroduction: null,
    snsLinks: createEmptySnsLinks(),
    activityPlan: null,
    slug: null,
    publishRequestedAt: null,
    publishedAt: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  });
}

// ==================== インメモリ実装 ====================

class InMemoryUpdateProjectDraftPort implements UpdateProjectDraftPort {
  projects: Project[] = [];
  savedProjects: Project[] = [];
  savedFeedbacks: ProjectReviewFeedback[] = [];

  async findProjectById(projectId: string): Promise<Project | null> {
    return this.projects.find((p) => p.id.toString() === projectId) ?? null;
  }

  async saveProjectWithOptionalFeedback(params: {
    project: Project;
    reviewFeedback?: ProjectReviewFeedback;
  }): Promise<void> {
    this.savedProjects.push(params.project);
    if (params.reviewFeedback) {
      this.savedFeedbacks.push(params.reviewFeedback);
    }
  }
}

// ==================== テスト ====================

describe("UpdateProjectDraftUseCase", () => {
  let port: InMemoryUpdateProjectDraftPort;
  let useCase: UpdateProjectDraftUseCase;

  beforeEach(() => {
    port = new InMemoryUpdateProjectDraftPort();
    useCase = new UpdateProjectDraftUseCase(port);
  });

  // ---- ハッピーパス ----

  it("DRAFT プロジェクトを更新すると projectId と withdrawnFromPending=false が返る", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      title: "更新後タイトル",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.projectId).toBe(PROJECT_ID_STR);
    expect(result.value.withdrawnFromPending).toBe(false);
  });

  it("更新後に saveProjectWithOptionalFeedback が呼ばれる", async () => {
    port.projects.push(createTestProject());

    await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      title: "更新後タイトル",
    });

    expect(port.savedProjects).toHaveLength(1);
    expect(port.savedProjects[0].title).toBe("更新後タイトル");
  });

  // ---- エラーケース ----

  it("不正な accountId 形式で INVALID_ACCOUNT_ID", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: "not-a-uuid",
      title: "タイトル",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("INVALID_ACCOUNT_ID");
    expect(port.savedProjects).toHaveLength(0);
  });

  it("存在しないプロジェクト ID で PROJECT_NOT_FOUND", async () => {
    const result = await useCase.execute({
      projectId: "00000000-0000-4000-b000-000000000099",
      accountId: OWNER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("PROJECT_NOT_FOUND");
  });

  it("オーナーでないアカウントで NOT_OWNER", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OTHER_ACCOUNT_ID_STR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("NOT_OWNER");
  });

  it("PUBLISHED 状態で CANNOT_EDIT_PUBLISHED", async () => {
    port.projects.push(createTestProject({ publishStatus: PublishStatus.PUBLISHED }));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      title: "新しいタイトル",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("CANNOT_EDIT_PUBLISHED");
  });

  // ---- PENDING_REVIEW → 自動取下げ ----

  it("PENDING_REVIEW の更新で withdrawnFromPending=true になる", async () => {
    port.projects.push(createTestProject({ publishStatus: PublishStatus.PENDING_REVIEW }));

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      title: "編集による自動取下げ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.withdrawnFromPending).toBe(true);
  });

  it("PENDING_REVIEW の自動取下げでは ReviewFeedback は作成されない", async () => {
    port.projects.push(createTestProject({ publishStatus: PublishStatus.PENDING_REVIEW }));

    await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      title: "編集による自動取下げ",
    });

    expect(port.savedFeedbacks).toHaveLength(0);
  });

  it("DRAFT 更新では ReviewFeedback は記録されない", async () => {
    port.projects.push(createTestProject());

    await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      title: "更新後タイトル",
    });

    expect(port.savedFeedbacks).toHaveLength(0);
  });

  // ---- ドメインエラー ----

  it("空タイトルで DOMAIN_ERROR が返る", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      title: "",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("DOMAIN_ERROR");
    if (result.error.type !== "DOMAIN_ERROR") return;
    expect(result.error.domainError.type).toBe("TITLE_REQUIRED");
    expect(port.savedProjects).toHaveLength(0);
  });

  // ---- category エラー ----

  it("無効な category で INVALID_CATEGORY が返る", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      category: "NONEXISTENT",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("INVALID_CATEGORY");
    if (result.error.type !== "INVALID_CATEGORY") return;
    expect(result.error.value).toBe("NONEXISTENT");
    expect(port.savedProjects).toHaveLength(0);
  });

  it("有効な category で更新できる", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      category: "FOOD",
    });

    expect(result.ok).toBe(true);
    expect(port.savedProjects[0].category).toBe("FOOD");
  });

  // ---- location VO エラー ----

  it("不正な都道府県コードで INVALID_LOCATION が返る", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      location: { prefectureCode: "99" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("INVALID_LOCATION");
  });

  it("正しい都道府県コードで location が更新される", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      location: { prefectureCode: "13" },
    });

    expect(result.ok).toBe(true);
    expect(port.savedProjects[0].location?.prefectureCode).toBe("13");
  });

  // ---- snsLinks VO エラー ----

  it("長すぎる SNS URL で INVALID_SNS_LINKS が返る", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      snsLinks: { x: "a".repeat(501) },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("INVALID_SNS_LINKS");
  });

  // ---- phase ----

  it("有効な phase 値で更新できる", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      phase: "PLANNING",
    });

    expect(result.ok).toBe(true);
    expect(port.savedProjects[0].phase).toBe(ProjectPhase.PLANNING);
  });

  it("無効な phase 値で INVALID_PHASE が返る", async () => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      phase: "INVALID_VALUE",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("INVALID_PHASE");
    if (result.error.type !== "INVALID_PHASE") return;
    expect(result.error.value).toBe("INVALID_VALUE");
  });

  // ---- body（本文の文書データ） ----

  it("許可した要素と装飾だけの本文は、検査を通って保存される", async () => {
    port.projects.push(createTestProject());
    const body = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "見出し" }] },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "リンク",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
        { type: "youtube", attrs: { videoId: "dQw4w9WgXcQ" } },
      ],
    };

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      body,
    });

    expect(result.ok).toBe(true);
    expect(port.savedProjects[0].body?.toJSON()).toEqual(body);
  });

  it.each([
    [
      "javascript: のリンク",
      storyDoc({
        type: "text",
        text: "押して",
        marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
      }),
      "INVALID_LINK_HREF",
    ],
    [
      "外部ホストの画像",
      {
        type: "doc",
        content: [{ type: "image", attrs: { src: "https://evil.example.com/a.png" } }],
      },
      "INVALID_IMAGE_SRC",
    ],
    [
      // 画像の置き場所の決まりは画像のアップロード（#319）で決める。それまでは Supabase の画像も断る
      "Supabase Storage の画像",
      {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: "https://abc.supabase.co/storage/v1/object/public/project-images/a.png" },
          },
        ],
      },
      "INVALID_IMAGE_SRC",
    ],
    [
      "許可していない装飾（文字色）",
      storyDoc({ type: "text", text: "赤", marks: [{ type: "textStyle" }] }),
      "UNSUPPORTED_MARK",
    ],
  ])("%sを含む本文は INVALID_STORY で、保存されない", async (_, body, reason) => {
    port.projects.push(createTestProject());

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      title: "一緒に送ったタイトル",
      body,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      type: "INVALID_STORY",
      storyError: { type: "STORY_NOT_ALLOWED", reason },
    });
    expect(port.savedProjects).toHaveLength(0);
    // 一緒に送った他の項目も変わらない
    expect(port.projects[0].title).toBe("テストプロジェクト");
  });

  it("body に null を渡すと本文が空になる", async () => {
    port.projects.push(createTestProject());
    await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      body: storyDoc({ type: "text", text: "本文" }),
    });

    const result = await useCase.execute({
      projectId: PROJECT_ID_STR,
      accountId: OWNER_ACCOUNT_ID_STR,
      body: null,
    });

    expect(result.ok).toBe(true);
    expect(port.savedProjects[1].body).toBeNull();
  });
});
