import type { AccountId, Project, ProjectReviewFeedback } from "@physifun/domain";
import type { CreateProjectOutboxMessageParams } from "./RequestPublishPort";

/**
 * UseCase 側で ADMIN ロールチェックに使用するアカウント情報
 *
 * infrastructure 層の PrismaProjectCommandAdapter.findAccountById が
 * 構造的部分型で適合するよう、必要最小限のフィールドのみ定義する。
 */
export interface AccountForProjectApproval {
  readonly id: string;
  readonly roles: readonly string[];
}

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
  /**
   * アカウント ID でアカウントを検索する。
   * ADMIN ロールの二重防御（Route Handler + UseCase）のための第二防衛線。
   */
  findAccountById(accountId: string): Promise<AccountForProjectApproval | null>;

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
   * - Project 集約の更新 (status=PUBLISHED, publishedAt / updatedAt は UseCase から渡される同一 Date)
   * - ProjectReviewFeedback (action=APPROVED) の作成
   * - ProjectOutboxMessage (公開承認通知メール) の作成
   * をアトミックに永続化する。
   */
  executeApproveInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
    /**
     * Project の publishedAt に設定する日時。
     * updatedAt との時刻ズレを防ぐため、UseCase は project.updatedAt と同じ値を渡す。
     */
    publishedAt: Date;
  }): Promise<void>;
}
