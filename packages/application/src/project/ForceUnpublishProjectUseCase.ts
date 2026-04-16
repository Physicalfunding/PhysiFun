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
import type { ForceUnpublishProjectPort } from "./ports/ForceUnpublishProjectPort";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface ForceUnpublishProjectOutput {
  readonly projectId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 *
 * - `INVALID_REVIEWER_ID`   : reviewerId が UUID v4 でない
 * - `INVALID_PROJECT_ID`    : projectId が UUID v4 でない
 * - `REVIEWER_NOTE_REQUIRED`: reviewerNote 未入力（trim 後に空）
 * - `PROJECT_NOT_FOUND`     : 指定 ID のプロジェクトが存在しない
 * - `DOMAIN_ERROR`          : Project.forceUnpublish の状態遷移エラー
 * - `FEEDBACK_ERROR`        : ProjectReviewFeedback 生成時のバリデーションエラー
 */
export type ForceUnpublishProjectError =
  | { readonly type: "INVALID_REVIEWER_ID" }
  | { readonly type: "INVALID_PROJECT_ID" }
  | { readonly type: "REVIEWER_NOTE_REQUIRED" }
  | { readonly type: "PROJECT_NOT_FOUND" }
  | { readonly type: "DOMAIN_ERROR"; readonly domainError: ProjectStateError }
  | { readonly type: "FEEDBACK_ERROR"; readonly feedbackError: ReviewFeedbackError };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface ForceUnpublishProjectInput {
  readonly projectId: string;
  readonly reviewerId: string;
  readonly reviewerNote: string;
}

// ==================== Outbox 定数 ====================

/**
 * リーダーへの強制非公開通知タスク種別
 *
 * Outbox ワーカーがリーダー向けに「運営により強制非公開となった」旨の
 * メールを送信する。
 */
export const PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE = "project_force_unpublished.notify";

// ==================== ユースケース ====================

/**
 * 運営による強制非公開ユースケース: PUBLISHED → DRAFT
 *
 * コンテンツ違反等に対応する運営オペレーション。
 * 後から理由を追跡できるよう `reviewerNote` を必須とし、
 * `ProjectReviewFeedback` に FORCE_UNPUBLISHED アクションを履歴として残す。
 *
 * 処理フロー:
 * 1. reviewerNote のバリデーション（trim して空なら REVIEWER_NOTE_REQUIRED）
 * 2. ReviewerId / ProjectId VO 生成（入力バリデーション）
 * 3. プロジェクトの存在チェック
 * 4. project.forceUnpublish()（PUBLISHED チェック + ステータス遷移）
 * 5. ProjectReviewFeedback 生成（action=FORCE_UNPUBLISHED, note=reviewerNote）
 * 6. Outbox メッセージ生成（リーダーへの通知メール）
 * 7. executeForceUnpublishInTransaction で 3 つをアトミックに永続化
 */
export class ForceUnpublishProjectUseCase {
  constructor(private readonly port: ForceUnpublishProjectPort) {}

  async execute(
    input: ForceUnpublishProjectInput
  ): Promise<Result<ForceUnpublishProjectOutput, ForceUnpublishProjectError>> {
    // 1. reviewerNote の必須チェック
    //    ProjectReviewFeedback.create 側でも NOTE_REQUIRED_FOR_ACTION を返すが、
    //    エラー型を UseCase 固有の REVIEWER_NOTE_REQUIRED として先に出す。
    if (input.reviewerNote.trim().length === 0) {
      return err({ type: "REVIEWER_NOTE_REQUIRED" });
    }

    // 2. ReviewerId / ProjectId VO 生成
    const reviewerIdResult = AccountId.from(input.reviewerId);
    if (!reviewerIdResult.ok) {
      return err({ type: "INVALID_REVIEWER_ID" });
    }

    const projectIdResult = ProjectId.from(input.projectId);
    if (!projectIdResult.ok) {
      return err({ type: "INVALID_PROJECT_ID" });
    }

    // 3. プロジェクトの存在チェック
    const project = await this.port.findProjectById(input.projectId);
    if (!project) {
      return err({ type: "PROJECT_NOT_FOUND" });
    }

    // 4. 強制非公開（ドメインロジック、PUBLISHED 以外は弾かれる）
    const forceUnpublishResult = project.forceUnpublish();
    if (!forceUnpublishResult.ok) {
      return err({ type: "DOMAIN_ERROR", domainError: forceUnpublishResult.error });
    }

    // 5. 審査フィードバック生成（FORCE_UNPUBLISHED は note 必須）
    const feedbackResult = ProjectReviewFeedback.create({
      projectId: projectIdResult.value,
      reviewerId: reviewerIdResult.value,
      action: ReviewAction.FORCE_UNPUBLISHED,
      note: input.reviewerNote,
      reviewedAt: project.updatedAt,
    });
    if (!feedbackResult.ok) {
      return err({ type: "FEEDBACK_ERROR", feedbackError: feedbackResult.error });
    }

    // 6. Outbox メッセージ生成（リーダーへの通知メール）
    const unpublishedAt = project.updatedAt;
    const outboxMessage = {
      id: randomUUID(),
      type: PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE,
      payload: {
        projectId: project.id.toString(),
        projectTitle: project.title,
        leaderAccountId: project.ownerAccountId.toString(),
        reviewerId: reviewerIdResult.value.toString(),
        reviewerNote: feedbackResult.value.note,
        unpublishedAt: unpublishedAt.toISOString(),
      },
    };

    // 7. 永続化（Project 更新 + ReviewFeedback 作成 + Outbox 書き込み）
    await this.port.executeForceUnpublishInTransaction({
      project,
      reviewFeedback: feedbackResult.value,
      outboxMessage,
    });

    return ok({ projectId: project.id.toString() });
  }
}
