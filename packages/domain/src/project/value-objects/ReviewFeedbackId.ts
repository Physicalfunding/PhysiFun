import { randomUUID } from "node:crypto";
import { type Result, err, ok } from "../../shared/result";

/**
 * ReviewFeedbackId 値オブジェクト
 *
 * ProjectReviewFeedback を一意に識別する ID。UUID v4 形式。
 */
export class ReviewFeedbackId {
  private constructor(private readonly value: string) {}

  static generate(): ReviewFeedbackId {
    return new ReviewFeedbackId(randomUUID());
  }

  static from(
    value: string
  ): Result<ReviewFeedbackId, InvalidReviewFeedbackIdError> {
    if (!UUID_V4_REGEX.test(value)) {
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

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
