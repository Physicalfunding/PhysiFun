import { PrismaProjectQueryService, PrismaProjectCommandAdapter } from "@physifun/infrastructure";
import type {
  ApproveProjectPublicationPort,
  ProjectQueryPort,
  RequestPublishPort,
  CreateProjectOutboxMessageParams,
} from "@physifun/application";
import type { AccountId, Project, ProjectReviewFeedback } from "@physifun/domain";

export function getProjectQueryService(): ProjectQueryPort {
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
 * 公開承認は Project 更新・ProjectReviewFeedback 作成・
 * ProjectOutboxMessage 書き込みを単一トランザクションで実行する必要があるため、
 * executeApproveInTransaction と Case A 用の countPublishedByOwner を提供する。
 * また、UseCase 層での ADMIN ロール二重防御のために findAccountById も提供する。
 *
 * NOTE: 他の DI ヘルパーと同様に PrismaProjectCommandAdapter を独自インスタンス化し、
 * Port ごとの依存関係を明示的に分離する。
 */
export function getApproveProjectPublicationPort(): ApproveProjectPublicationPort {
  const adapter = new PrismaProjectCommandAdapter();
  return {
    findAccountById: (accountId: string) => adapter.findAccountById(accountId),
    findProjectById: (id: string) => adapter.findProjectById(id),
    countPublishedByOwner: (ownerAccountId: AccountId) =>
      adapter.countPublishedByOwner(ownerAccountId),
    executeApproveInTransaction: (params: {
      project: Project;
      reviewFeedback: ProjectReviewFeedback;
      outboxMessage: CreateProjectOutboxMessageParams;
      publishedAt: Date;
    }) => adapter.executeApproveInTransaction(params),
  };
}
