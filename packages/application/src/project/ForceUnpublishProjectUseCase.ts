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
 * - `REVIEWER_NOTE_TOO_LONG`: reviewerNote が上限超過（trim 後）
 * - `REVIEWER_NOT_FOUND`    : reviewerId のアカウントが存在しない
 * - `REVIEWER_NOT_ADMIN`    : reviewer が ADMIN ロールを持たない（UseCase 層の二重防御）
 * - `PROJECT_NOT_FOUND`     : 指定 ID のプロジェクトが存在しない
 * - `DOMAIN_ERROR`          : Project.forceUnpublish の状態遷移エラー
 * - `FEEDBACK_ERROR`        : ProjectReviewFeedback 生成時のバリデーションエラー
 */
export type ForceUnpublishProjectError =
  | { readonly type: "INVALID_REVIEWER_ID" }
  | { readonly type: "INVALID_PROJECT_ID" }
  | { readonly type: "REVIEWER_NOTE_REQUIRED" }
  | {
      readonly type: "REVIEWER_NOTE_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    }
  | { readonly type: "REVIEWER_NOT_FOUND" }
  | { readonly type: "REVIEWER_NOT_ADMIN" }
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
 * 1. reviewerNote のバリデーション（trim / 空なら REVIEWER_NOTE_REQUIRED / 長すぎなら REVIEWER_NOTE_TOO_LONG）
 * 2. ReviewerId / ProjectId VO 生成（入力バリデーション）
 * 3. reviewer の ADMIN ロールチェック（API Route Handler と二重防御）
 * 4. プロジェクトの存在チェック
 * 5. project.forceUnpublish()（PUBLISHED チェック + ステータス遷移）
 * 6. ProjectReviewFeedback 生成（action=FORCE_UNPUBLISHED, note=trimmedNote）
 * 7. Outbox メッセージ生成（リーダーへの通知メール、payload.reviewerNote は trim 済み string）
 * 8. executeForceUnpublishInTransaction で 3 つをアトミックに永続化
 */
export class ForceUnpublishProjectUseCase {
  constructor(private readonly port: ForceUnpublishProjectPort) {}

  async execute(
    input: ForceUnpublishProjectInput
  ): Promise<Result<ForceUnpublishProjectOutput, ForceUnpublishProjectError>> {
    // 1. reviewerNote の必須 / 長さチェック
    //    trim 済みの値を UseCase 層で一元管理し、ProjectReviewFeedback / Outbox
    //    payload の両方に同じ string 値を渡す（string | null 混在を避ける）。
    const trimmedNote = input.reviewerNote.trim();
    if (trimmedNote.length === 0) {
      return err({ type: "REVIEWER_NOTE_REQUIRED" });
    }
    if (trimmedNote.length > REVIEW_FEEDBACK_NOTE_MAX_LENGTH) {
      return err({
        type: "REVIEWER_NOTE_TOO_LONG",
        maxLength: REVIEW_FEEDBACK_NOTE_MAX_LENGTH,
        actualLength: trimmedNote.length,
      });
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

    // 3. reviewer の ADMIN ロール二重防御（API Route Handler の認可に加えて）
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

    // 4. プロジェクトの存在チェック
    const project = await this.port.findProjectById(input.projectId);
    if (!project) {
      return err({ type: "PROJECT_NOT_FOUND" });
    }

    // 5. 強制非公開（ドメインロジック、PUBLISHED 以外は弾かれる）
    const forceUnpublishResult = project.forceUnpublish();
    if (!forceUnpublishResult.ok) {
      return err({ type: "DOMAIN_ERROR", domainError: forceUnpublishResult.error });
    }

    // 6. 審査フィードバック生成（FORCE_UNPUBLISHED は note 必須）
    //    trim 済みの値を渡す（ProjectReviewFeedback 内部でも再度 trim されるが等価）
    const feedbackResult = ProjectReviewFeedback.create({
      projectId: projectIdResult.value,
      reviewerId: reviewerIdResult.value,
      action: ReviewAction.FORCE_UNPUBLISHED,
      note: trimmedNote,
      reviewedAt: project.updatedAt,
    });
    if (!feedbackResult.ok) {
      return err({ type: "FEEDBACK_ERROR", feedbackError: feedbackResult.error });
    }

    // 7. Outbox メッセージ生成（リーダーへの通知メール）
    //    payload.reviewerNote は trim 済み string 型で保証する（string | null にしない）
    const unpublishedAt = project.updatedAt;
    const outboxMessage: {
      id: string;
      type: string;
      payload: {
        projectId: string;
        projectTitle: string;
        leaderAccountId: string;
        reviewerId: string;
        reviewerNote: string;
        unpublishedAt: string;
      };
    } = {
      id: randomUUID(),
      type: PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE,
      payload: {
        projectId: project.id.toString(),
        projectTitle: project.title,
        leaderAccountId: project.ownerAccountId.toString(),
        reviewerId: reviewerIdResult.value.toString(),
        reviewerNote: trimmedNote,
        unpublishedAt: unpublishedAt.toISOString(),
      },
    };

    // 8. 永続化（Project 更新 + ReviewFeedback 作成 + Outbox 書き込み）
    await this.port.executeForceUnpublishInTransaction({
      project,
      reviewFeedback: feedbackResult.value,
      outboxMessage,
    });

    return ok({ projectId: project.id.toString() });
  }
}
