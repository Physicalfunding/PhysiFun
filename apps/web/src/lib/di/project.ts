import { PrismaProjectQueryService, PrismaProjectCommandAdapter } from "@physifun/infrastructure";
import type {
  ApproveProjectPublicationPort,
  ProjectQueryPort,
  PublicProjectQueryPort,
  RequestPublishPort,
  CreateProjectOutboxMessageParams,
  RejectProjectPublicationPort,
  ForceUnpublishProjectPort,
} from "@physifun/application";
import type { Project, ProjectReviewFeedback } from "@physifun/domain";

export function getProjectQueryService(): ProjectQueryPort {
  return new PrismaProjectQueryService();
}

/**
 * 公開ページ向けクエリサービス。
 *
 * PublicProjectQueryPort を介してインフラ層の具象クラスに依存しない。
 */
export function getPublicProjectQueryService(): PublicProjectQueryPort {
  return new PrismaProjectQueryService();
}

export function getProjectCommandAdapter() {
  return new PrismaProjectCommandAdapter();
}

/**
 * Withdraw (WithdrawProjectUseCase) と Unpublish (UnpublishProjectUseCase)
 * 用の共通ポート生成ヘルパー
 *
 * 単純な Project 更新のみを行うユースケース（PENDING_REVIEW → DRAFT,
 * PUBLISHED → DRAFT）が必要とする { findProjectById, saveProject }
 * ポートを組み立てる。
 * RequestPublish は Outbox 通知を伴うため、別途 getRequestPublishPort を使用する。
 *
 * NOTE: PrismaProjectCommandAdapter は Prisma クライアント経由で動作する
 * stateless なアダプタのため、上位の getProjectCommandAdapter() と共有せず
 * DI 関数ごとに独自インスタンス化している。これは Port ごとの依存関係を
 * 明示的に分離し、将来 Port 単位で実装差し替え（モック化等）をしやすくするための意図的な設計。
 */
export function getProjectStatusPort() {
  const adapter = new PrismaProjectCommandAdapter();
  return {
    findProjectById: (id: string) => adapter.findProjectById(id),
    saveProject: (project: Project) => adapter.saveProjectWithOptionalFeedback({ project }),
  };
}

/**
 * RequestPublishUseCase 用のポート生成ヘルパー
 *
 * 公開申請は Project 更新と ProjectOutboxMessage 書き込みを
 * 単一トランザクションで実行する必要があるため、executeInTransaction を提供する。
 *
 * NOTE: getProjectStatusPort と同様に、PrismaProjectCommandAdapter は stateless な
 * アダプタであるため DI 関数ごとに独自インスタンス化している。共通の
 * getProjectCommandAdapter() を意図的に使用せず、Port ごとの依存関係を
 * 明示的に分離している。
 */
export function getRequestPublishPort(): RequestPublishPort {
  const adapter = new PrismaProjectCommandAdapter();
  return {
    findProjectById: (id: string) => adapter.findProjectById(id),
    executeInTransaction: (params: {
      project: Project;
      outboxMessage: CreateProjectOutboxMessageParams;
    }) => adapter.executeInTransaction(params),
  };
}

/**
 * ApproveProjectPublicationUseCase 用のポート生成ヘルパー
 *
 * 公開承認は
 * - Case A 上限チェック（同一オーナーの PUBLISHED 件数）
 * - Project 更新
 * - ProjectReviewFeedback 作成
 * - ProjectOutboxMessage 書き込み
 * を単一トランザクション（interactive tx）で実行する必要があるため、
 * executeApproveInTransaction を提供する。
 * 運営の二重防御のために findAdminReviewerById も提供する（#145 以降は AdminAccount 参照）。
 *
 * NOTE: 他の DI ヘルパーと同様に PrismaProjectCommandAdapter を独自インスタンス化し、
 * Port ごとの依存関係を明示的に分離する。
 */
export function getApproveProjectPublicationPort(): ApproveProjectPublicationPort {
  const adapter = new PrismaProjectCommandAdapter();
  return {
    findAdminReviewerById: (id: string) => adapter.findAdminReviewerById(id),
    findProjectById: (id: string) => adapter.findProjectById(id),
    executeApproveInTransaction: (params: {
      project: Project;
      reviewFeedback: ProjectReviewFeedback;
      outboxMessage: CreateProjectOutboxMessageParams;
      publishedAt: Date;
      maxPublishedPerOwner: number;
    }) => adapter.executeApproveInTransaction(params),
  };
}

/**
 * RejectProjectPublicationUseCase 用のポート生成ヘルパー
 *
 * 運営差戻は Project 更新 / ProjectReviewFeedback 作成 /
 * ProjectOutboxMessage 書き込みを同一トランザクションで実行する必要があるため、
 * executeRejectInTransaction を提供する。
 *
 * NOTE: getProjectStatusPort / getRequestPublishPort と同様、
 * PrismaProjectCommandAdapter は stateless なため DI 関数ごとに独自インスタンス化する。
 */
export function getRejectProjectPublicationPort(): RejectProjectPublicationPort {
  const adapter = new PrismaProjectCommandAdapter();
  return {
    findAdminReviewerById: (id: string) => adapter.findAdminReviewerById(id),
    findProjectById: (id: string) => adapter.findProjectById(id),
    executeRejectInTransaction: (params: {
      project: Project;
      reviewFeedback: ProjectReviewFeedback;
      outboxMessage: CreateProjectOutboxMessageParams;
    }) => adapter.executeRejectInTransaction(params),
  };
}

/**
 * ForceUnpublishProjectUseCase 用のポート生成ヘルパー
 *
 * 運営による強制非公開 (PUBLISHED → DRAFT) は
 *  - Project.status 更新
 *  - ProjectReviewFeedback 作成 (FORCE_UNPUBLISHED)
 *  - ProjectOutboxMessage 書き込み (リーダー通知メール)
 * を同一トランザクションで実行する必要があるため、専用のヘルパーを切り出している。
 *
 * NOTE: 他の DI 関数と同様に、PrismaProjectCommandAdapter は stateless なため
 * DI 関数ごとに独自インスタンス化している。Port ごとの依存関係を明示的に
 * 分離するための意図的な設計。
 */
export function getForceUnpublishProjectPort(): ForceUnpublishProjectPort {
  const adapter = new PrismaProjectCommandAdapter();
  return {
    findAdminReviewerById: (id: string) => adapter.findAdminReviewerById(id),
    findProjectById: (id: string) => adapter.findProjectById(id),
    executeForceUnpublishInTransaction: (params: {
      project: Project;
      reviewFeedback: ProjectReviewFeedback;
      outboxMessage: CreateProjectOutboxMessageParams;
    }) => adapter.executeForceUnpublishInTransaction(params),
  };
}
