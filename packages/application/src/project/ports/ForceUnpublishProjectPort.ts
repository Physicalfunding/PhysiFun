import type { Project, ProjectReviewFeedback } from "@physifun/domain";
import type { CreateProjectOutboxMessageParams } from "./RequestPublishPort";
import type { AdminReviewer } from "../../shared/AdminReviewer";

/**
 * ForceUnpublishProjectUseCase のポートインターフェース
 *
 * インフラ層で実装する。運営による強制非公開化は以下の 3 つを
 * 単一トランザクションで実行する:
 *
 * 1. Project.status 更新 (PUBLISHED → DRAFT)
 * 2. ProjectReviewFeedback 作成 (action=FORCE_UNPUBLISHED, note=理由)
 * 3. ProjectOutboxMessage 書き込み (リーダーへの通知メール)
 *
 * Outbox パターンにより通知メール配信タスクを DB に永続化し、
 * 後段のワーカーが拾って配信する。
 */
export interface ForceUnpublishProjectPort {
  /**
   * AdminAccount ID で reviewer を検索する。
   *
   * インフラ側で status !== "ACTIVE" は null にマップされるため、
   * UseCase は null を「見つからない or 無効化済み」として扱えばよい。
   */
  findAdminReviewerById(id: string): Promise<AdminReviewer | null>;

  /** プロジェクトID で Project 集約を取得する */
  findProjectById(projectId: string): Promise<Project | null>;

  /**
   * Project 集約の更新・ProjectReviewFeedback 作成・
   * ProjectOutboxMessage 書き込みを 1 つのトランザクションで実行する。
   */
  executeForceUnpublishInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void>;
}
