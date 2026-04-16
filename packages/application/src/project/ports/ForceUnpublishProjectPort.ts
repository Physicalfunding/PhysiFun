import type { Project, ProjectReviewFeedback } from "@physifun/domain";
import type { CreateProjectOutboxMessageParams } from "./RequestPublishPort";

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
   * アカウント ID でアカウントの id / roles を取得する。
   *
   * UseCase 層でも ADMIN ロールを二重チェックするために使う
   * （第一防衛線は API Route Handler の getToken ベース認可）。
   * 構造的部分型により PrismaProjectCommandAdapter.findAccountById が適合する。
   */
  findAccountById(
    accountId: string
  ): Promise<{ readonly id: string; readonly roles: readonly string[] } | null>;

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
