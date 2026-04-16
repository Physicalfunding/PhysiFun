import { randomUUID } from "node:crypto";
import {
  type Result,
  err,
  ok,
  AccountId,
  ProjectId,
  ProjectReviewFeedback,
  ReviewAction,
  type ProjectStateError,
  type ReviewFeedbackError,
} from "@physifun/domain";
import type { ApproveProjectPublicationPort } from "./ports/ApproveProjectPublicationPort";

// ==================== 定数 ====================

/**
 * 同一オーナーが同時に保持できる PUBLISHED プロジェクトの上限 (Case A)
 */
export const MAX_PUBLISHED_PROJECTS_PER_OWNER = 3;

/**
 * プロジェクト公開承認通知 (プロジェクトオーナー宛) の Outbox task type
 *
 * Outbox ワーカーが「プロジェクトが承認され公開されました」旨の
 * メールをプロジェクトオーナー宛に送信する。
 */
export const PROJECT_PUBLISH_APPROVED_NOTIFY_TYPE = "project_publish_approved.notify";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface ApproveProjectPublicationOutput {
  readonly projectId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 *
 * - `INVALID_PROJECT_ID` / `INVALID_REVIEWER_ID`: 入力バリデーション
 * - `REVIEWER_NOT_FOUND`: 審査者アカウントが存在しない
 * - `REVIEWER_NOT_ADMIN`: 審査者が ADMIN ロールを持たない（UseCase 層の第二防衛線）
 * - `PROJECT_NOT_FOUND`: 対象プロジェクトが存在しない
 * - `INVALID_PROJECT_STATUS`: PENDING_REVIEW 以外からの承認 (ドメイン状態違反)
 * - `OWNER_PUBLISHED_LIMIT_EXCEEDED`: Case A - 同一オーナーが既に 3 件 PUBLISHED
 * - `REVIEW_FEEDBACK_ERROR`: ReviewFeedback 生成時のバリデーション失敗
 */
export type ApproveProjectPublicationError =
  | { readonly type: "INVALID_PROJECT_ID" }
  | { readonly type: "INVALID_REVIEWER_ID" }
  | { readonly type: "REVIEWER_NOT_FOUND" }
  | { readonly type: "REVIEWER_NOT_ADMIN" }
  | { readonly type: "PROJECT_NOT_FOUND" }
  | {
      readonly type: "INVALID_PROJECT_STATUS";
      readonly domainError: ProjectStateError;
    }
  | {
      readonly type: "OWNER_PUBLISHED_LIMIT_EXCEEDED";
      readonly maxCount: number;
      readonly currentCount: number;
    }
  | {
      readonly type: "REVIEW_FEEDBACK_ERROR";
      readonly feedbackError: ReviewFeedbackError;
    };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface ApproveProjectPublicationInput {
  readonly projectId: string;
  readonly reviewerId: string;
  readonly note?: string;
}

// ==================== ユースケース ====================

/**
 * プロジェクト公開承認ユースケース: PENDING_REVIEW → PUBLISHED
 *
 * 処理フロー:
 * 1. ProjectId / ReviewerId VO 生成（入力バリデーション）
 * 2. 審査者の ADMIN ロールチェック（Route Handler と二重防御）
 * 3. プロジェクトの存在チェック
 * 4. project.approveByAdmin() 呼び出し（ドメイン状態遷移チェック）
 * 5. Case A 再検証: オーナーの PUBLISHED 件数 >= 3 ならエラー
 * 6. ProjectReviewFeedback (action=APPROVED) を生成
 * 7. 承認通知メール Outbox メッセージを生成
 * 8. executeApproveInTransaction で Project 更新 + ReviewFeedback 作成 +
 *    Outbox 書き込みを同一トランザクションで永続化
 */
export class ApproveProjectPublicationUseCase {
  constructor(private readonly port: ApproveProjectPublicationPort) {}

  async execute(
    input: ApproveProjectPublicationInput
  ): Promise<Result<ApproveProjectPublicationOutput, ApproveProjectPublicationError>> {
    // 1. 入力バリデーション
    const projectIdResult = ProjectId.from(input.projectId);
    if (!projectIdResult.ok) {
      return err({ type: "INVALID_PROJECT_ID" });
    }

    const reviewerIdResult = AccountId.from(input.reviewerId);
    if (!reviewerIdResult.ok) {
      return err({ type: "INVALID_REVIEWER_ID" });
    }

    // 2. 審査者の ADMIN ロールチェック（Route Handler と二重防御）
    const reviewer = await this.port.findAccountById(input.reviewerId);
    if (!reviewer) {
      return err({ type: "REVIEWER_NOT_FOUND" });
    }
    if (!reviewer.roles.includes("ADMIN")) {
      return err({ type: "REVIEWER_NOT_ADMIN" });
    }

    // 3. プロジェクトの存在チェック
    const project = await this.port.findProjectById(input.projectId);
    if (!project) {
      return err({ type: "PROJECT_NOT_FOUND" });
    }

    // 4. ドメイン状態遷移（PENDING_REVIEW チェック含む）
    const approveResult = project.approveByAdmin();
    if (!approveResult.ok) {
      return err({
        type: "INVALID_PROJECT_STATUS",
        domainError: approveResult.error,
      });
    }

    // 5. Case A 再検証: PUBLISHED 件数上限
    // 現在の project 自身は approveByAdmin 直後で PUBLISHED に遷移しているが、
    // DB 上はまだ PENDING_REVIEW のためカウント対象外。超過判定は >= 3。
    const publishedCount = await this.port.countPublishedByOwner(project.ownerAccountId);
    if (publishedCount >= MAX_PUBLISHED_PROJECTS_PER_OWNER) {
      return err({
        type: "OWNER_PUBLISHED_LIMIT_EXCEEDED",
        maxCount: MAX_PUBLISHED_PROJECTS_PER_OWNER,
        currentCount: publishedCount,
      });
    }

    // 6. ProjectReviewFeedback 生成 (action=APPROVED, note optional)
    const feedbackResult = ProjectReviewFeedback.create({
      projectId: project.id,
      reviewerId: reviewerIdResult.value,
      action: ReviewAction.APPROVED,
      note: input.note ?? null,
    });
    if (!feedbackResult.ok) {
      return err({
        type: "REVIEW_FEEDBACK_ERROR",
        feedbackError: feedbackResult.error,
      });
    }

    // 7. Outbox メッセージ生成（公開承認通知メール、プロジェクトオーナー宛）
    const approvedAt = project.updatedAt;
    const outboxMessage = {
      id: randomUUID(),
      type: PROJECT_PUBLISH_APPROVED_NOTIFY_TYPE,
      payload: {
        projectId: project.id.toString(),
        projectTitle: project.title,
        leaderAccountId: project.ownerAccountId.toString(),
        reviewerId: reviewerIdResult.value.toString(),
        approvedAt: approvedAt.toISOString(),
      },
    };

    // 8. トランザクション内で永続化
    // publishedAt と updatedAt は同じ値 (project.updatedAt = approveByAdmin 直後の timestamp) を渡す。
    await this.port.executeApproveInTransaction({
      project,
      reviewFeedback: feedbackResult.value,
      outboxMessage,
      publishedAt: project.updatedAt,
    });

    return ok({ projectId: project.id.toString() });
  }
}
