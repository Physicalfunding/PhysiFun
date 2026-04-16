import type { Project } from "@physifun/domain";

/**
 * UnpublishProjectUseCase のポートインターフェース
 *
 * インフラ層で実装する。
 */
export interface UnpublishProjectPort {
  /** プロジェクトID で Project 集約を取得する */
  findProjectById(projectId: string): Promise<Project | null>;

  /** Project 集約を永続化する */
  saveProject(project: Project): Promise<void>;
}
