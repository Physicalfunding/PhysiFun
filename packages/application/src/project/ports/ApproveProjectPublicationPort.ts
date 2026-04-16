import type { AccountId, Project, ProjectReviewFeedback } from "@physifun/domain";
import type { CreateProjectOutboxMessageParams } from "./RequestPublishPort";

/**
 * ApproveProjectPublicationUseCase のポートインターフェース
 *
 * インフラ層で実装する。承認処理は
 * - Project.status 更新 (PENDING_REVIEW → PUBLISHED)
 * - ProjectReviewFeedback (action=APPROVED) の作成
 * - ProjectOutboxMessage への承認通知メール登録
 * を同一トランザクションで実行する。
 *
 * Case A（同一オーナーの PUBLISHED 件数が 3 件以上ならエラー）は
 * UseCase 側で countPublishedByOwner を呼び先行チェックするが、
 * TOCTOU を可能な限り減らすためアダプタ側での同一 tx 内 count と組み合わせる
 * 余地を残している。
 */
export interface ApproveProjectPublicationPort {
  /** プロジェクトID で Project 集約を取得する */
  findProjectById(projectId: string): Promise<Project | null>;

  /**
   * 指定オーナーの PUBLISHED 件数を取得する。
   *
   * Case A（PUBLISHED 3 件上限）の再検証に使用する。
   * 承認対象プロジェクト自身は PENDING_REVIEW のためカウント対象外。
   */
  countPublishedByOwner(ownerAccountId: AccountId): Promise<number>;

  /**
   * 承認処理をトランザクションで実行する。
   *
   * - Project 集約の更新 (status=PUBLISHED, publishedAt=now)
   * - ProjectReviewFeedback (action=APPROVED) の作成
   * - ProjectOutboxMessage (公開承認通知メール) の作成
   * をアトミックに永続化する。
   */
  executeApproveInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void>;
}
