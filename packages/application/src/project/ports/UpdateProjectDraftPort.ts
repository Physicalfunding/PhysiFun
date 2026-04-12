import type { Project, ProjectReviewFeedback } from "@physifun/domain";

/**
 * UpdateProjectDraftUseCase のポートインターフェース
 *
 * インフラ層で実装する。
 */
export interface UpdateProjectDraftPort {
  /** プロジェクトID で Project 集約を取得する */
  findProjectById(projectId: string): Promise<Project | null>;

  /** Project 集約を永続化する */
  saveProject(project: Project): Promise<void>;

  /** 自動取下げ時の審査フィードバックを永続化する */
  saveReviewFeedback(feedback: ProjectReviewFeedback): Promise<void>;
}
