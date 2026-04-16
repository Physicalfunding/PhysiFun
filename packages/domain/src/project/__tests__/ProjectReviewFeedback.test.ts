import { describe, expect, it } from "@jest/globals";
import { AccountId } from "../../account/value-objects/AccountId";
import { ProjectReviewFeedback } from "../entities/ProjectReviewFeedback";
import { ProjectId } from "../value-objects/ProjectId";
import { ReviewAction } from "../value-objects/ReviewAction";
import { ReviewFeedbackId } from "../value-objects/ReviewFeedbackId";

describe("ProjectReviewFeedback", () => {
  const projectId = ProjectId.generate();
  const reviewerId = AccountId.generate();

  describe("create", () => {
    it("APPROVED + note なしで成功", () => {
      const result = ProjectReviewFeedback.create({
        projectId,
        reviewerId,
        action: ReviewAction.APPROVED,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.action).toBe(ReviewAction.APPROVED);
        expect(result.value.note).toBeNull();
      }
    });

    it("APPROVED + note ありで成功", () => {
      const result = ProjectReviewFeedback.create({
        projectId,
        reviewerId,
        action: ReviewAction.APPROVED,
        note: "問題なし",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.note).toBe("問題なし");
      }
    });

    it("REJECTED + note ありで成功", () => {
      const result = ProjectReviewFeedback.create({
        projectId,
        reviewerId,
        action: ReviewAction.REJECTED,
        note: "内容が不明瞭です",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.action).toBe(ReviewAction.REJECTED);
        expect(result.value.note).toBe("内容が不明瞭です");
      }
    });

    it("REJECTED + note なしでエラー", () => {
      const result = ProjectReviewFeedback.create({
        projectId,
        reviewerId,
        action: ReviewAction.REJECTED,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("NOTE_REQUIRED_FOR_ACTION");
      }
    });

    it("REJECTED + note 空白のみでエラー", () => {
      const result = ProjectReviewFeedback.create({
        projectId,
        reviewerId,
        action: ReviewAction.REJECTED,
        note: "   ",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("NOTE_REQUIRED_FOR_ACTION");
      }
    });

    it("REJECTED + note 2000 文字超でエラー", () => {
      const result = ProjectReviewFeedback.create({
        projectId,
        reviewerId,
        action: ReviewAction.REJECTED,
        note: "a".repeat(2001),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("NOTE_TOO_LONG");
      }
    });

    it("REJECTED + note 2000 文字ちょうどは OK", () => {
      const result = ProjectReviewFeedback.create({
        projectId,
        reviewerId,
        action: ReviewAction.REJECTED,
        note: "a".repeat(2000),
      });
      expect(result.ok).toBe(true);
    });

    it("FORCE_UNPUBLISHED + note 必須", () => {
      const noNote = ProjectReviewFeedback.create({
        projectId,
        reviewerId,
        action: ReviewAction.FORCE_UNPUBLISHED,
      });
      expect(noNote.ok).toBe(false);

      const withNote = ProjectReviewFeedback.create({
        projectId,
        reviewerId,
        action: ReviewAction.FORCE_UNPUBLISHED,
        note: "規約違反",
      });
      expect(withNote.ok).toBe(true);
    });
  });

  describe("reconstruct", () => {
    it("全フィールドを復元できる", () => {
      const now = new Date();
      const feedback = ProjectReviewFeedback.reconstruct({
        id: ReviewFeedbackId.generate(),
        projectId,
        reviewerId,
        action: ReviewAction.REJECTED,
        note: "差戻理由",
        reviewedAt: now,
      });
      expect(feedback.projectId.equals(projectId)).toBe(true);
      expect(feedback.action).toBe(ReviewAction.REJECTED);
      expect(feedback.note).toBe("差戻理由");
      expect(feedback.reviewedAt).toEqual(now);
    });
  });
});
