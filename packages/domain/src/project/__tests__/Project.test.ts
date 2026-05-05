import { describe, expect, it } from "@jest/globals";
import { AccountId } from "../../account/value-objects/AccountId";
import { ProjectLocation } from "../../shared/value-objects/ProjectLocation";
import { SnsLinks } from "../../shared/value-objects/SnsLinks";
import { Project } from "../entities/Project";
import { ProjectId } from "../value-objects/ProjectId";
import { ProjectPhase } from "../value-objects/ProjectPhase";
import { PublishStatus } from "../value-objects/PublishStatus";

function emptySns(): SnsLinks {
  const r = SnsLinks.create({});
  if (!r.ok) throw new Error("fixture broken");
  return r.value;
}

function validLocation(): ProjectLocation {
  const r = ProjectLocation.create({ prefectureCode: "13" });
  if (!r.ok) throw new Error("fixture broken");
  return r.value;
}

function unwrapDraft(input?: { ownerAccountId?: AccountId; title?: string }): Project {
  const result = Project.createDraft({
    ownerAccountId: input?.ownerAccountId ?? AccountId.generate(),
    title: input?.title ?? "テストプロジェクト",
  });
  if (!result.ok) throw new Error("createDraft failed in fixture");
  return result.value;
}

/** 公開時必須項目を全て満たした Project を作成する */
function createFullDraft(): Project {
  const project = unwrapDraft({ title: "古民家再生プロジェクト" });
  const updateResult = project.update({
    coverImageUrl: "https://example.com/image.jpg",
    category: "KOMINKA",
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

describe("Project", () => {
  describe("createDraft", () => {
    it("title のみで DRAFT 状態のプロジェクトが作成される", () => {
      const result = Project.createDraft({
        ownerAccountId: AccountId.generate(),
        title: "テストプロジェクト",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const project = result.value;
      expect(project.publishStatus).toBe(PublishStatus.DRAFT);
      expect(project.title).toBe("テストプロジェクト");
      expect(project.coverImageUrl).toBeNull();
      expect(project.category).toBeNull();
      expect(project.location).toBeNull();
      expect(project.phase).toBe(ProjectPhase.VISION);
      expect(project.summary).toBeNull();
      expect(project.body).toBeNull();
      expect(project.leaderIntroduction).toBeNull();
      expect(project.activityPlan).toBeNull();
    });

    it("title の前後空白はトリムされる", () => {
      const result = Project.createDraft({
        ownerAccountId: AccountId.generate(),
        title: "  テスト  ",
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.title).toBe("テスト");
    });

    it("id と createdAt が自動設定される", () => {
      const project = unwrapDraft();
      expect(project.id).toBeInstanceOf(ProjectId);
      expect(project.createdAt).toBeInstanceOf(Date);
    });

    it("title 空文字はエラー", () => {
      const result = Project.createDraft({
        ownerAccountId: AccountId.generate(),
        title: "",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("TITLE_REQUIRED");
    });

    it("title 空白のみはエラー", () => {
      const result = Project.createDraft({
        ownerAccountId: AccountId.generate(),
        title: "   ",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("TITLE_REQUIRED");
    });

    it("title 101 文字はエラー", () => {
      const result = Project.createDraft({
        ownerAccountId: AccountId.generate(),
        title: "あ".repeat(101),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("TITLE_TOO_LONG");
    });
  });

  describe("update", () => {
    it("DRAFT 状態で全フィールドを更新できる", () => {
      const project = unwrapDraft({ title: "初期タイトル" });
      const result = project.update({
        title: "更新タイトル",
        coverImageUrl: "https://example.com/new.jpg",
        category: "DIY",
        location: validLocation(),
        phase: ProjectPhase.PLANNING,
        summary: "概要",
        body: "本文",
        leaderIntroduction: "紹介",
        activityPlan: "活動計画",
        snsLinks: emptySns(),
      });
      expect(result.ok).toBe(true);
      expect(project.title).toBe("更新タイトル");
      expect(project.category).toBe("DIY");
      expect(project.phase).toBe(ProjectPhase.PLANNING);
    });

    it("title 空文字はエラー", () => {
      const project = unwrapDraft();
      const result = project.update({ title: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("TITLE_REQUIRED");
    });

    it("title 100 文字超はエラー", () => {
      const project = unwrapDraft();
      const result = project.update({ title: "あ".repeat(101) });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("TITLE_TOO_LONG");
    });

    it("無効な category はエラー", () => {
      const project = unwrapDraft();
      const result = project.update({ category: "INVALID_VALUE" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("INVALID_CATEGORY");
    });

    it("category null は許容", () => {
      const project = unwrapDraft();
      project.update({ category: "KOMINKA" });
      const result = project.update({ category: null });
      expect(result.ok).toBe(true);
      expect(project.category).toBeNull();
    });

    it("PUBLISHED 状態で公開必須項目を落とすとエラー（エンティティは変更されない）", () => {
      const project = createFullDraft();
      project.requestPublish();
      project.approveByAdmin();
      const originalTitle = project.title;
      const result = project.update({ summary: null, title: "新タイトル" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("CANNOT_UPDATE_PUBLISHED_MISSING_FIELDS");
      }
      // guard-first, write-last: エラー時はエンティティが変更されない
      expect(project.title).toBe(originalTitle);
      expect(project.summary).not.toBeNull();
    });

    it("PUBLISHED 状態で公開必須項目を維持すれば更新可", () => {
      const project = createFullDraft();
      project.requestPublish();
      project.approveByAdmin();
      const result = project.update({ title: "新しいタイトル" });
      expect(result.ok).toBe(true);
      expect(project.title).toBe("新しいタイトル");
    });

    it("PENDING_REVIEW 状態で編集すると自動で DRAFT に戻る", () => {
      const project = createFullDraft();
      project.requestPublish();
      expect(project.publishStatus).toBe(PublishStatus.PENDING_REVIEW);
      const result = project.update({ title: "編集後タイトル" });
      expect(result.ok).toBe(true);
      expect(project.title).toBe("編集後タイトル");
      expect(project.publishStatus).toBe(PublishStatus.DRAFT);
    });

    it("PENDING_REVIEW 状態で無効な更新をするとエラー（ステータスも変わらない）", () => {
      const project = createFullDraft();
      project.requestPublish();
      const result = project.update({ title: "" });
      expect(result.ok).toBe(false);
      // エラー時はステータスも変わらない
      expect(project.publishStatus).toBe(PublishStatus.PENDING_REVIEW);
    });
  });

  describe("requestPublish", () => {
    it("公開必須項目が全て揃えば PENDING_REVIEW に遷移", () => {
      const project = createFullDraft();
      const result = project.requestPublish();
      expect(result.ok).toBe(true);
      expect(project.publishStatus).toBe(PublishStatus.PENDING_REVIEW);
    });

    it("公開必須項目が欠落しているとエラー（欠落フィールドリスト付き）", () => {
      const project = unwrapDraft();
      const result = project.requestPublish();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("PUBLICATION_REQUIREMENTS_NOT_MET");
        if (result.error.type === "PUBLICATION_REQUIREMENTS_NOT_MET") {
          expect(result.error.missingFields).toContain("coverImageUrl");
          expect(result.error.missingFields).toContain("category");
          expect(result.error.missingFields).toContain("location");
          expect(result.error.missingFields).toContain("summary");
          expect(result.error.missingFields).toContain("body");
          expect(result.error.missingFields).toContain("leaderIntroduction");
        }
      }
    });

    it("PENDING_REVIEW からは遷移エラー", () => {
      const project = createFullDraft();
      project.requestPublish();
      const result = project.requestPublish();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("CANNOT_REQUEST_PUBLISH_NON_DRAFT");
    });

    it("PUBLISHED からは遷移エラー", () => {
      const project = createFullDraft();
      project.requestPublish();
      project.approveByAdmin();
      const result = project.requestPublish();
      expect(result.ok).toBe(false);
    });
  });

  describe("withdraw", () => {
    it("PENDING_REVIEW → DRAFT に遷移", () => {
      const project = createFullDraft();
      project.requestPublish();
      const result = project.withdraw();
      expect(result.ok).toBe(true);
      expect(project.publishStatus).toBe(PublishStatus.DRAFT);
    });

    it("DRAFT からはエラー", () => {
      const project = createFullDraft();
      const result = project.withdraw();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("CANNOT_WITHDRAW_NON_PENDING");
    });

    it("PUBLISHED からはエラー", () => {
      const project = createFullDraft();
      project.requestPublish();
      project.approveByAdmin();
      const result = project.withdraw();
      expect(result.ok).toBe(false);
    });
  });

  describe("approveByAdmin", () => {
    it("PENDING_REVIEW → PUBLISHED に遷移", () => {
      const project = createFullDraft();
      project.requestPublish();
      const result = project.approveByAdmin();
      expect(result.ok).toBe(true);
      expect(project.publishStatus).toBe(PublishStatus.PUBLISHED);
    });

    it("DRAFT からはエラー", () => {
      const project = createFullDraft();
      const result = project.approveByAdmin();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("CANNOT_APPROVE_NON_PENDING");
    });

    it("PUBLISHED からはエラー", () => {
      const project = createFullDraft();
      project.requestPublish();
      project.approveByAdmin();
      const result = project.approveByAdmin();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("CANNOT_APPROVE_NON_PENDING");
    });
  });

  describe("rejectByAdmin", () => {
    it("PENDING_REVIEW → DRAFT に遷移", () => {
      const project = createFullDraft();
      project.requestPublish();
      const result = project.rejectByAdmin();
      expect(result.ok).toBe(true);
      expect(project.publishStatus).toBe(PublishStatus.DRAFT);
    });

    it("DRAFT からはエラー", () => {
      const project = createFullDraft();
      const result = project.rejectByAdmin();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("CANNOT_REJECT_NON_PENDING");
    });

    it("PUBLISHED からはエラー", () => {
      const project = createFullDraft();
      project.requestPublish();
      project.approveByAdmin();
      const result = project.rejectByAdmin();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("CANNOT_REJECT_NON_PENDING");
    });
  });

  describe("unpublishSelf", () => {
    it("PUBLISHED → DRAFT に遷移", () => {
      const project = createFullDraft();
      project.requestPublish();
      project.approveByAdmin();
      const result = project.unpublishSelf();
      expect(result.ok).toBe(true);
      expect(project.publishStatus).toBe(PublishStatus.DRAFT);
    });

    it("DRAFT からはエラー", () => {
      const project = createFullDraft();
      const result = project.unpublishSelf();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("CANNOT_UNPUBLISH_NON_PUBLISHED");
    });

    it("PENDING_REVIEW からはエラー", () => {
      const project = createFullDraft();
      project.requestPublish();
      const result = project.unpublishSelf();
      expect(result.ok).toBe(false);
    });
  });

  describe("forceUnpublish", () => {
    it("PUBLISHED → DRAFT に遷移", () => {
      const project = createFullDraft();
      project.requestPublish();
      project.approveByAdmin();
      const result = project.forceUnpublish();
      expect(result.ok).toBe(true);
      expect(project.publishStatus).toBe(PublishStatus.DRAFT);
    });

    it("DRAFT からはエラー", () => {
      const project = createFullDraft();
      const result = project.forceUnpublish();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED");
    });

    it("PENDING_REVIEW からはエラー", () => {
      const project = createFullDraft();
      project.requestPublish();
      const result = project.forceUnpublish();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED");
    });
  });

  describe("reconstruct", () => {
    it("全フィールドを復元できる", () => {
      const id = ProjectId.generate();
      const ownerAccountId = AccountId.generate();
      const now = new Date();
      const project = Project.reconstruct({
        id,
        ownerAccountId,
        title: "復元テスト",
        coverImageUrl: "https://example.com/img.jpg",
        category: "KOMINKA",
        location: validLocation(),
        phase: ProjectPhase.EXECUTION,
        publishStatus: PublishStatus.PUBLISHED,
        summary: "概要",
        body: "本文",
        leaderIntroduction: "紹介",
        snsLinks: emptySns(),
        activityPlan: "計画",
        createdAt: now,
        updatedAt: now,
      });
      expect(project.id.equals(id)).toBe(true);
      expect(project.ownerAccountId.equals(ownerAccountId)).toBe(true);
      expect(project.title).toBe("復元テスト");
      expect(project.publishStatus).toBe(PublishStatus.PUBLISHED);
      expect(project.phase).toBe(ProjectPhase.EXECUTION);
    });
  });

  describe("phase の自由変更", () => {
    it("任意のフェーズに切替できる", () => {
      const project = unwrapDraft();
      expect(project.phase).toBe(ProjectPhase.VISION);

      project.update({ phase: ProjectPhase.ONGOING });
      expect(project.phase).toBe(ProjectPhase.ONGOING);

      project.update({ phase: ProjectPhase.PLANNING });
      expect(project.phase).toBe(ProjectPhase.PLANNING);
    });
  });

  describe("createForLeaderApproval", () => {
    function baseInput() {
      return {
        id: ProjectId.generate(),
        ownerAccountId: AccountId.generate(),
        title: "承認時に作成された Project",
        coverImageUrl: null,
        category: "COMMUNITY" as const,
        location: validLocation(),
        phase: ProjectPhase.PLANNING,
        summary: "応募内容由来のサマリー",
        body: "応募内容由来の本文",
        leaderIntroduction: null,
        snsLinks: emptySns(),
        activityPlan: "応募内容由来の活動計画",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    it("有効な入力で DRAFT の Project を生成する", () => {
      const result = Project.createForLeaderApproval(baseInput());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.publishStatus).toBe(PublishStatus.DRAFT);
      expect(result.value.title).toBe("承認時に作成された Project");
      expect(result.value.summary).toBe("応募内容由来のサマリー");
      expect(result.value.body).toBe("応募内容由来の本文");
      expect(result.value.activityPlan).toBe("応募内容由来の活動計画");
      expect(result.value.phase).toBe(ProjectPhase.PLANNING);
    });

    it("title が空文字なら TITLE_REQUIRED", () => {
      const result = Project.createForLeaderApproval({ ...baseInput(), title: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("TITLE_REQUIRED");
    });

    it("title が 100 文字超なら TITLE_TOO_LONG", () => {
      const tooLong = "あ".repeat(101);
      const result = Project.createForLeaderApproval({ ...baseInput(), title: tooLong });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("TITLE_TOO_LONG");
    });

    it("body が 10000 文字超なら BODY_TOO_LONG", () => {
      const tooLong = "あ".repeat(10001);
      const result = Project.createForLeaderApproval({ ...baseInput(), body: tooLong });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("BODY_TOO_LONG");
    });

    it("title 前後の空白はトリムされる", () => {
      const result = Project.createForLeaderApproval({ ...baseInput(), title: "  test  " });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.title).toBe("test");
    });

    it("nullable フィールドは null をそのまま受け入れる", () => {
      const result = Project.createForLeaderApproval({
        ...baseInput(),
        summary: null,
        body: null,
        leaderIntroduction: null,
        activityPlan: null,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.summary).toBeNull();
      expect(result.value.body).toBeNull();
      expect(result.value.leaderIntroduction).toBeNull();
      expect(result.value.activityPlan).toBeNull();
    });
  });
});
