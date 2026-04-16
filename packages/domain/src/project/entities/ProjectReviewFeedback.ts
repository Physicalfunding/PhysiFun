import type { AccountId } from "../../account/value-objects/AccountId";
import { type Result, err, ok } from "../../shared/result";
import type { ProjectId } from "../value-objects/ProjectId";
import { ReviewAction } from "../value-objects/ReviewAction";
import { ReviewFeedbackId } from "../value-objects/ReviewFeedbackId";

/**
 * note の文字数上限（Phase 1 仮値）
 */
const MAX_NOTE_LENGTH = 2000;

/**
 * note が必須の ReviewAction
 */
const NOTE_REQUIRED_ACTIONS: readonly ReviewAction[] = [
  ReviewAction.REJECTED,
  ReviewAction.FORCE_UNPUBLISHED,
];

/**
 * ProjectReviewFeedback エンティティ
 *
 * 運営による審査結果を履歴として保持する。
 * Project と 1:N の関係。差戻が繰り返される場合も全履歴が残る。
 */
export class ProjectReviewFeedback {
  private constructor(
    private readonly _id: ReviewFeedbackId,
    private readonly _projectId: ProjectId,
    private readonly _reviewerId: AccountId,
    private readonly _action: ReviewAction,
    private readonly _note: string | null,
    private readonly _reviewedAt: Date
  ) {}

  static create(input: {
    projectId: ProjectId;
    reviewerId: AccountId;
    action: ReviewAction;
    note?: string | null;
    reviewedAt?: Date;
    id?: ReviewFeedbackId;
  }): Result<ProjectReviewFeedback, ReviewFeedbackError> {
    const noteRequired = NOTE_REQUIRED_ACTIONS.includes(input.action);
    const rawNote = input.note ?? null;

    let normalizedNote: string | null = null;
    if (rawNote !== null) {
      const trimmed = rawNote.trim();
      if (trimmed.length === 0) {
        if (noteRequired) {
          return err({ type: "NOTE_REQUIRED_FOR_ACTION", action: input.action });
        }
      } else if (trimmed.length > MAX_NOTE_LENGTH) {
        return err({
          type: "NOTE_TOO_LONG",
          maxLength: MAX_NOTE_LENGTH,
          actualLength: trimmed.length,
        });
      } else {
        normalizedNote = trimmed;
      }
    } else if (noteRequired) {
      return err({ type: "NOTE_REQUIRED_FOR_ACTION", action: input.action });
    }

    return ok(
      new ProjectReviewFeedback(
        input.id ?? ReviewFeedbackId.generate(),
        input.projectId,
        input.reviewerId,
        input.action,
        normalizedNote,
        input.reviewedAt ?? new Date()
      )
    );
  }

  static reconstruct(input: {
    id: ReviewFeedbackId;
    projectId: ProjectId;
    reviewerId: AccountId;
    action: ReviewAction;
    note: string | null;
    reviewedAt: Date;
  }): ProjectReviewFeedback {
    return new ProjectReviewFeedback(
      input.id,
      input.projectId,
      input.reviewerId,
      input.action,
      input.note,
      input.reviewedAt
    );
  }

  get id(): ReviewFeedbackId {
    return this._id;
  }
  get projectId(): ProjectId {
    return this._projectId;
  }
  get reviewerId(): AccountId {
    return this._reviewerId;
  }
  get action(): ReviewAction {
    return this._action;
  }
  get note(): string | null {
    return this._note;
  }
  get reviewedAt(): Date {
    return this._reviewedAt;
  }
}

export type ReviewFeedbackError =
  | { readonly type: "NOTE_REQUIRED_FOR_ACTION"; readonly action: ReviewAction }
  | {
      readonly type: "NOTE_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    };

export const REVIEW_FEEDBACK_NOTE_MAX_LENGTH = MAX_NOTE_LENGTH;
