import { type Result, err, ok } from "../../shared/result";
import { generateUuidV7, isUuid } from "../../shared/uuid";

/**
 * ReviewFeedbackId 値オブジェクト
 *
 * ProjectReviewFeedback を一意に識別する ID。UUID（v4 か v7）の形式。
 */
export class ReviewFeedbackId {
  private constructor(private readonly value: string) {}

  static generate(): ReviewFeedbackId {
    return new ReviewFeedbackId(generateUuidV7());
  }

  static from(value: string): Result<ReviewFeedbackId, InvalidReviewFeedbackIdError> {
    if (!isUuid(value)) {
      return err({ type: "INVALID_REVIEW_FEEDBACK_ID_FORMAT", value });
    }
    return ok(new ReviewFeedbackId(value));
  }

  toString(): string {
    return this.value;
  }

  equals(other: ReviewFeedbackId): boolean {
    return this.value === other.value;
  }
}

export interface InvalidReviewFeedbackIdError {
  readonly type: "INVALID_REVIEW_FEEDBACK_ID_FORMAT";
  readonly value: string;
}
