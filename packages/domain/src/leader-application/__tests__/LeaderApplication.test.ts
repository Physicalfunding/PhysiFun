import { beforeEach, describe, expect, it } from "@jest/globals";
import { AccountId } from "../../account/value-objects/AccountId";
import {
  LEADER_APPLICATION_REVIEWER_NOTE_MAX_LENGTH,
  LeaderApplication,
} from "../entities/LeaderApplication";
import { LeaderApplicationId } from "../value-objects/LeaderApplicationId";
import { LeaderApplicationStatus } from "../value-objects/LeaderApplicationStatus";
import { ProjectDraft } from "../value-objects/ProjectDraft";
import { ProjectLocation } from "../value-objects/ProjectLocation";
import { SnsLinks } from "../value-objects/SnsLinks";

function buildProjectDraft(): ProjectDraft {
  const location = ProjectLocation.create({ prefectureCode: "13" });
  const sns = SnsLinks.create({});
  if (!location.ok || !sns.ok) throw new Error("fixture broken");
  const draft = ProjectDraft.create({
    projectTitle: "古民家再生プロジェクト",
    projectSummary: "築100年の古民家を再生する",
    projectStory: "想いと背景",
    projectCategory: "KOMINKA",
    location: location.value,
    plannedActivities: "週末イベント",
    snsLinks: sns.value,
  });
  if (!draft.ok) throw new Error("fixture broken");
  return draft.value;
}

describe("LeaderApplication", () => {
  let accountId: AccountId;
  let draft: ProjectDraft;

  beforeEach(() => {
    accountId = AccountId.generate();
    draft = buildProjectDraft();
  });

  describe("submit", () => {
    it("状態 PENDING で生成される", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      expect(app.status).toBe(LeaderApplicationStatus.PENDING);
    });

    it("accountId / projectDraft / submittedAt が設定される", () => {
      const submittedAt = new Date("2026-04-12T00:00:00Z");
      const app = LeaderApplication.submit({
        accountId,
        projectDraft: draft,
        submittedAt,
      });
      expect(app.accountId.equals(accountId)).toBe(true);
      expect(app.projectDraft.equals(draft)).toBe(true);
      expect(app.submittedAt).toEqual(submittedAt);
    });

    it("reviewedAt / reviewerNote は null で初期化される", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      expect(app.reviewedAt).toBeNull();
      expect(app.reviewerNote).toBeNull();
    });

    it("id は省略時に自動生成される", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      expect(app.id).toBeInstanceOf(LeaderApplicationId);
    });

    it("id は明示指定もできる", () => {
      const id = LeaderApplicationId.generate();
      const app = LeaderApplication.submit({
        accountId,
        projectDraft: draft,
        id,
      });
      expect(app.id.equals(id)).toBe(true);
    });
  });

  describe("reconstruct", () => {
    it("永続化状態からエンティティを復元できる", () => {
      const id = LeaderApplicationId.generate();
      const submittedAt = new Date("2026-04-10T10:00:00Z");
      const reviewedAt = new Date("2026-04-11T10:00:00Z");
      const app = LeaderApplication.reconstruct({
        id,
        accountId,
        status: LeaderApplicationStatus.APPROVED,
        projectDraft: draft,
        submittedAt,
        reviewedAt,
        reviewerNote: null,
      });
      expect(app.id.equals(id)).toBe(true);
      expect(app.status).toBe(LeaderApplicationStatus.APPROVED);
      expect(app.submittedAt).toEqual(submittedAt);
      expect(app.reviewedAt).toEqual(reviewedAt);
    });
  });

  describe("approve", () => {
    it("PENDING → APPROVED に遷移する", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      const result = app.approve();
      expect(result.ok).toBe(true);
      expect(app.status).toBe(LeaderApplicationStatus.APPROVED);
    });

    it("承認時に reviewedAt が設定される", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      const reviewedAt = new Date("2026-04-12T12:00:00Z");
      app.approve({ reviewedAt });
      expect(app.reviewedAt).toEqual(reviewedAt);
    });

    it("APPROVED からの承認はエラー（冪等性確保）", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      app.approve();
      const result = app.approve();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("CANNOT_APPROVE_NON_PENDING");
        if (result.error.type === "CANNOT_APPROVE_NON_PENDING") {
          expect(result.error.currentStatus).toBe("APPROVED");
        }
      }
    });

    it("REJECTED からの承認はエラー", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      app.reject({ reviewerNote: "内容不明瞭" });
      const result = app.approve();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("CANNOT_APPROVE_NON_PENDING");
      }
    });
  });

  describe("reject", () => {
    it("PENDING → REJECTED に遷移する", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      const result = app.reject({ reviewerNote: "企画内容が不明瞭" });
      expect(result.ok).toBe(true);
      expect(app.status).toBe(LeaderApplicationStatus.REJECTED);
    });

    it("reviewerNote が保存される（トリム後）", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      app.reject({ reviewerNote: "  企画内容が不明瞭  " });
      expect(app.reviewerNote).toBe("企画内容が不明瞭");
    });

    it("reviewedAt が設定される", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      const reviewedAt = new Date("2026-04-12T12:00:00Z");
      app.reject({ reviewerNote: "却下", reviewedAt });
      expect(app.reviewedAt).toEqual(reviewedAt);
    });

    it("reviewerNote が空文字はエラー", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      const result = app.reject({ reviewerNote: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("REVIEWER_NOTE_REQUIRED");
      }
    });

    it("reviewerNote が空白のみはエラー", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      const result = app.reject({ reviewerNote: "   " });
      expect(result.ok).toBe(false);
    });

    it("reviewerNote 上限超はエラー", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      const tooLong = "a".repeat(LEADER_APPLICATION_REVIEWER_NOTE_MAX_LENGTH + 1);
      const result = app.reject({ reviewerNote: tooLong });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("REVIEWER_NOTE_TOO_LONG");
      }
    });

    it("reviewerNote 上限ちょうどは OK", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      const exact = "a".repeat(LEADER_APPLICATION_REVIEWER_NOTE_MAX_LENGTH);
      const result = app.reject({ reviewerNote: exact });
      expect(result.ok).toBe(true);
    });

    it("APPROVED からの却下はエラー", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      app.approve();
      const result = app.reject({ reviewerNote: "後から却下" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("CANNOT_REJECT_NON_PENDING");
      }
    });

    it("REJECTED からの却下はエラー（冪等性確保）", () => {
      const app = LeaderApplication.submit({ accountId, projectDraft: draft });
      app.reject({ reviewerNote: "一度目" });
      const result = app.reject({ reviewerNote: "二度目" });
      expect(result.ok).toBe(false);
    });
  });
});
