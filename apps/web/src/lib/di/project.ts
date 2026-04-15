import {
  PrismaProjectQueryService,
  PrismaProjectCommandAdapter,
} from "@physifun/infrastructure";
import type { ProjectQueryPort } from "@physifun/application";
import type { Project } from "@physifun/domain";

export function getProjectQueryService(): ProjectQueryPort {
  return new PrismaProjectQueryService();
}

export function getProjectCommandAdapter() {
  return new PrismaProjectCommandAdapter();
}

/**
 * RequestPublish / Withdraw / Unpublish 用の共通ポート生成ヘルパー
 *
 * 各ステータス変更ユースケースが必要とする
 * { findProjectById, saveProject } ポートを組み立てる。
 */
export function getProjectStatusPort() {
  const adapter = new PrismaProjectCommandAdapter();
  return {
    findProjectById: (id: string) => adapter.findProjectById(id),
    saveProject: (project: Project) =>
      adapter.saveProjectWithOptionalFeedback({ project }),
  };
}
