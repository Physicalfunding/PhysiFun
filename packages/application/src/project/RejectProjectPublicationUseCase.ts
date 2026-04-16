import { randomUUID } from "node:crypto";
import {
  type Result,
  err,
  ok,
  AccountId,
  ProjectId,
  ProjectReviewFeedback,
  REVIEW_FEEDBACK_NOTE_MAX_LENGTH,
  ReviewAction,
  PublishStatus,
} from "@physifun/domain";
import type { RejectProjectPublicationPort } from "./ports/RejectProjectPublicationPort";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface RejectProjectPublicationOutput {
  readonly projectId: string;
}

// ==================== エラー型 ====================

/**
 * reviewerNote 未入力エラー（空文字 / 空白のみ / trim 後空）
 */
export interface ReviewerNoteRequiredError {
  readonly type: "REVIEWER_NOTE_REQUIRED";
}

/**
 * プロジェクトが見つからないエラー
 */
export interface ProjectNotFoundError {
  readonly type: "PROJECT_NOT_FOUND";
}

/**
 * 現在のステータスから差戻遷移できないエラー
 * （PENDING_REVIEW 以外の状態から呼ばれた場合）
 */
export interface InvalidProjectStatusError {
  readonly type: "INVALID_PROJECT_STATUS";
  readonly currentStatus: PublishStatus;
}

/**
 * ユースケースのエラー型（判別共用体）
 *
 * Issue #78 で明示要求された 3 エラー型に加え、入力形式バリデーション用の
 * 2 メンバー（INVALID_REVIEWER_ID / INVALID_PROJECT_ID）、
 * UseCase 層の ADMIN 二重防御で検出される 2 メンバー
 * （REVIEWER_NOT_FOUND / REVIEWER_NOT_ADMIN）、
 * および reviewerNote の文字数超過を表す REVIEWER_NOTE_TOO_LONG を持つ。
 */
export type RejectProjectPublicationError =
  | ReviewerNoteRequiredError
  | ProjectNotFoundError
  | InvalidProjectStatusError
  | { readonly type: "INVALID_REVIEWER_ID" }
  | { readonly type: "INVALID_PROJECT_ID" }
  | { readonly type: "REVIEWER_NOT_FOUND" }
  | { readonly type: "REVIEWER_NOT_ADMIN" }
  | { readonly type: "REVIEWER_NOTE_TOO_LONG"; readonly maxLength: number };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface RejectProjectPublicationInput {
  readonly projectId: string;
  readonly reviewerId: string;
  readonly reviewerNote: string;
}

// ==================== Outbox 定数 ====================

/**
 * リーダーへの公開申請差戻通知タスク種別
 *
 * Outbox ワーカーが対象リーダーに「公開申請が差戻された」旨のメールを送信する。
 */
export const LEADER_PUBLISH_REJECTED_NOTIFY_TYPE = "project_publish_rejected.notify";

// ==================== ユースケース ====================

/**
 * 運営差戻ユースケース: PENDING_REVIEW → DRAFT
 *
 * 処理フロー:
 * 1. reviewerNote バリデーション（trim して空なら REVIEWER_NOTE_REQUIRED）
 * 2. ReviewerId（AccountId） / ProjectId VO 生成（形式バリデーション）
 * 3. プロジェクトの存在チェック
 * 4. project.rejectByAdmin()（PENDING_REVIEW のみ許可）
 * 5. ProjectReviewFeedback を生成 (action=REJECTED, note=reviewerNote)
 * 6. Outbox メッセージ生成（差戻通知メール）
 * 7. Project 更新 / ReviewFeedback 作成 / Outbox 書き込みを
 *    同一トランザクションでアトミックに永続化
 */
export class RejectProjectPublicationUseCase {
  constructor(private readonly port: RejectProjectPublicationPort) {}

  async execute(
    input: RejectProjectPublicationInput
  ): Promise<Result<RejectProjectPublicationOutput, RejectProjectPublicationError>> {
    // 1. reviewerNote バリデーション（空/空白のみは拒否）
    // input.reviewerNote は型上 string のため optional chaining は不要。
    const trimmedNote = input.reviewerNote.trim();
    if (trimmedNote.length === 0) {
      return err({ type: "REVIEWER_NOTE_REQUIRED" });
    }

    // 2. reviewerId / projectId VO 生成
    const reviewerIdResult = AccountId.from(input.reviewerId);
    if (!reviewerIdResult.ok) {
      return err({ type: "INVALID_REVIEWER_ID" });
    }

    const projectIdResult = ProjectId.from(input.projectId);
    if (!projectIdResult.ok) {
      return err({ type: "INVALID_PROJECT_ID" });
    }

    // 3. ADMIN ロール二重防御（Route Handler 側の認可とは独立に UseCase 単体でも担保）
    const reviewer = await this.port.findAccountById(input.reviewerId);
    if (!reviewer) {
      return err({ type: "REVIEWER_NOT_FOUND" });
    }
    if (!reviewer.roles.includes("ADMIN")) {
      return err({ type: "REVIEWER_NOT_ADMIN" });
    }

    // 4. プロジェクトの存在チェック
    const project = await this.port.findProjectById(input.projectId);
    if (!project) {
      return err({ type: "PROJECT_NOT_FOUND" });
    }

    // 4. 差戻（ドメインロジック: PENDING_REVIEW チェック + 状態遷移）
    const rejectResult = project.rejectByAdmin();
    if (!rejectResult.ok) {
      // rejectByAdmin() は現状 CANNOT_REJECT_NON_PENDING のみ返すが、
      // ProjectStateError 全体の判別共用体に対する安全な狭め方をしておく。
      if (rejectResult.error.type === "CANNOT_REJECT_NON_PENDING") {
        return err({
          type: "INVALID_PROJECT_STATUS",
          currentStatus: rejectResult.error.currentStatus,
        });
      }
      // 到達不可能な他のエラー種別はフォールバックで現ステータスを返す。
      return err({
        type: "INVALID_PROJECT_STATUS",
        currentStatus: project.publishStatus,
      });
    }

    // 5. ProjectReviewFeedback を生成
    // rejectByAdmin() 内で updatedAt が差戻日時にセット済み
    const reviewedAt = project.updatedAt;
    const feedbackResult = ProjectReviewFeedback.create({
      projectId: projectIdResult.value,
      reviewerId: reviewerIdResult.value,
      action: ReviewAction.REJECTED,
      note: trimmedNote,
      reviewedAt,
    });
    if (!feedbackResult.ok) {
      // 上流で trim 済みの note を渡しているため NOTE_REQUIRED_FOR_ACTION は発生しない。
      // NOTE_TOO_LONG は専用エラー（REVIEWER_NOTE_TOO_LONG）にマッピングし、
      // Route Handler 側で 400 バリデーションエラーとして maxLength を返せるようにする。
      if (feedbackResult.error.type === "NOTE_TOO_LONG") {
        return err({
          type: "REVIEWER_NOTE_TOO_LONG",
          maxLength: REVIEW_FEEDBACK_NOTE_MAX_LENGTH,
        });
      }
      // NOTE_REQUIRED_FOR_ACTION は到達不可能だが、安全側で REQUIRED に集約する。
      return err({ type: "REVIEWER_NOTE_REQUIRED" });
    }

    // 6. Outbox メッセージ生成（差戻通知メール）
    const outboxMessage = {
      id: randomUUID(),
      type: LEADER_PUBLISH_REJECTED_NOTIFY_TYPE,
      payload: {
        projectId: project.id.toString(),
        projectTitle: project.title,
        leaderAccountId: project.ownerAccountId.toString(),
        reviewerId: reviewerIdResult.value.toString(),
        reviewerNote: trimmedNote,
        rejectedAt: reviewedAt.toISOString(),
      },
    };

    // 7. トランザクション内で永続化
    await this.port.executeRejectInTransaction({
      project,
      reviewFeedback: feedbackResult.value,
      outboxMessage,
    });

    return ok({ projectId: project.id.toString() });
  }
}
