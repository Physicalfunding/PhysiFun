import type { Project, ProjectReviewFeedback } from "@physifun/domain";
import type { CreateProjectOutboxMessageParams } from "./RequestPublishPort";

/**
 * RejectProjectPublicationUseCase のポートインターフェース
 *
 * 運営が公開申請を差戻す際、以下をすべて同一トランザクションで実行する:
 * - Project 集約の更新（PENDING_REVIEW → DRAFT）
 * - ProjectReviewFeedback の作成（action=REJECTED, note=reviewerNote）
 * - ProjectOutboxMessage の作成（差戻通知メール）
 *
 * トランザクションメソッド名は公開申請側（executeInTransaction）と
 * 混同しないよう `executeRejectInTransaction` として分離する。
 */
export interface RejectProjectPublicationPort {
  /** プロジェクトID で Project 集約を取得する */
  findProjectById(projectId: string): Promise<Project | null>;

  /**
   * Project 更新 / ProjectReviewFeedback 作成 / Outbox 書き込みを
   * 単一トランザクションで実行する。
   *
   * Outbox パターン: リーダーへの差戻通知メール送信タスクを DB に
   * 永続化し、後段ワーカーが拾って配信する。
   */
  executeRejectInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void>;
}
