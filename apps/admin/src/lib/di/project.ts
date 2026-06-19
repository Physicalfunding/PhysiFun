import { KyselyProjectCommandAdapter } from "@physifun/infrastructure/src/kysely";
import type {
  ApproveProjectPublicationPort,
  RejectProjectPublicationPort,
  ForceUnpublishProjectPort,
  CreateProjectOutboxMessageParams,
} from "@physifun/application";
import type { Project, ProjectReviewFeedback } from "@physifun/domain";

/**
 * ApproveProjectPublicationUseCase 用のポート生成ヘルパー
 *
 * apps/web/src/lib/di/project.ts と同等の DI ヘルパーを admin 側にも提供し、
 * Route Handler が @physifun/infrastructure を直接参照しないようにする。
 */
export function getApproveProjectPublicationPort(): ApproveProjectPublicationPort {
  const adapter = new KyselyProjectCommandAdapter();
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
 */
export function getRejectProjectPublicationPort(): RejectProjectPublicationPort {
  const adapter = new KyselyProjectCommandAdapter();
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
 */
export function getForceUnpublishProjectPort(): ForceUnpublishProjectPort {
  const adapter = new KyselyProjectCommandAdapter();
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
