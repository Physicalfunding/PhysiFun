import type { Project, ProjectReviewFeedback } from "@physifun/domain";
import type { CreateProjectOutboxMessageParams } from "./RequestPublishPort";
import type { AdminReviewer } from "../../shared/AdminReviewer";

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
 * TOCTOU を防ぐため、executeApproveInTransaction 内で同一 tx 内 count と
 * 上限チェックを行う。超過時は OwnerPublishedLimitExceededError をスローする。
 */
export interface ApproveProjectPublicationPort {
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
   * 承認処理をトランザクションで実行する。
   *
   * - Case A 上限チェック（同一 tx 内で count → 超過時 OwnerPublishedLimitExceededError throw）
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
    /** 同一オーナーが同時に保持できる PUBLISHED プロジェクトの上限 */
    maxPublishedPerOwner: number;
  }): Promise<void>;
}
