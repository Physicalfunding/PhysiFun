import { randomUUID } from "node:crypto";
import {
  type Result,
  err,
  ok,
  AccountId,
  ProjectId,
  ProjectReviewFeedback,
  ReviewAction,
  REVIEW_FEEDBACK_NOTE_MAX_LENGTH,
  type ProjectStateError,
  type ReviewFeedbackError,
} from "@physifun/domain";
import type { ApproveProjectPublicationPort } from "./ports/ApproveProjectPublicationPort";

// ==================== 定数 ====================

/**
 * 同一オーナーが同時に保持できる PUBLISHED プロジェクトの上限 (Case A)
 */
export const MAX_PUBLISHED_PROJECTS_PER_OWNER = 3;

// ==================== エラー ====================

/**
 * executeApproveInTransaction が Case A 上限超過時にスローするエラー
 *
 * 同一トランザクション内で count → 上限チェックを実行することで
 * TOCTOU を解消する。UseCase 側で catch して
 * OWNER_PUBLISHED_LIMIT_EXCEEDED にマッピングする。
 */
export class OwnerPublishedLimitExceededError extends Error {
  constructor() {
    super("Owner published project limit exceeded");
    this.name = "OwnerPublishedLimitExceededError";
  }
}

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
    }
  | {
      readonly type: "REVIEW_FEEDBACK_ERROR";
      readonly feedbackError: ReviewFeedbackError;
    }
  | {
      readonly type: "REVIEWER_NOTE_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
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
 * 5. ProjectReviewFeedback (action=APPROVED) を生成
 * 6. 承認通知メール Outbox メッセージを生成
 * 7. executeApproveInTransaction で
 *    - Case A 上限チェック (PUBLISHED 件数 >= 3 なら throw)
 *    - Project 更新 + ReviewFeedback 作成 + Outbox 書き込み
 *    を同一トランザクションで永続化（TOCTOU 解消）
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

    // 1b. note の長さチェック（optional だが渡された場合は上限チェック）
    if (input.note != null && input.note.trim().length > REVIEW_FEEDBACK_NOTE_MAX_LENGTH) {
      return err({
        type: "REVIEWER_NOTE_TOO_LONG",
        maxLength: REVIEW_FEEDBACK_NOTE_MAX_LENGTH,
        actualLength: input.note.trim().length,
      });
    }

    // 2. 審査者の ADMIN ロールチェック（Route Handler と二重防御）
    // TODO(#145): Phase 2 で Account.roles から "ADMIN" を除去したため
    // このチェックは常に false を返す。AdminAccount 認証移行と合わせて、
    // reviewerId を AdminAccount.id として検証するポートに差し替える。
    // 現状 apps/admin 側の認証が繋がっていないため、この UseCase は到達不能。
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

    // 5. ProjectReviewFeedback 生成 (action=APPROVED, note optional)
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

    // 6. Outbox メッセージ生成（公開承認通知メール、プロジェクトオーナー宛）
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

    // 7. トランザクション内で Case A 上限チェック + 永続化
    // publishedAt と updatedAt は同じ値 (project.updatedAt = approveByAdmin 直後の timestamp) を渡す。
    // Case A は interactive tx 内で count → 上限チェックを行うため TOCTOU を解消。
    try {
      await this.port.executeApproveInTransaction({
        project,
        reviewFeedback: feedbackResult.value,
        outboxMessage,
        publishedAt: project.updatedAt,
        maxPublishedPerOwner: MAX_PUBLISHED_PROJECTS_PER_OWNER,
      });
    } catch (e) {
      if (e instanceof OwnerPublishedLimitExceededError) {
        return err({
          type: "OWNER_PUBLISHED_LIMIT_EXCEEDED",
          maxCount: MAX_PUBLISHED_PROJECTS_PER_OWNER,
        });
      }
      throw e;
    }

    return ok({ projectId: project.id.toString() });
  }
}
