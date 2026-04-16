import { PrismaProjectQueryService, PrismaProjectCommandAdapter } from "@physifun/infrastructure";
import type {
  ProjectQueryPort,
  RequestPublishPort,
  CreateProjectOutboxMessageParams,
} from "@physifun/application";
import type { Project } from "@physifun/domain";

export function getProjectQueryService(): ProjectQueryPort {
  return new PrismaProjectQueryService();
}

export function getProjectCommandAdapter() {
  return new PrismaProjectCommandAdapter();
}

/**
 * Withdraw / Unpublish 用の共通ポート生成ヘルパー
 *
 * 単純な Project 更新のみを行うユースケース（PENDING_REVIEW → DRAFT,
 * PUBLISHED → DRAFT）が必要とする { findProjectById, saveProject }
 * ポートを組み立てる。
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
