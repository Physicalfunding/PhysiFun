import type { Project, ProjectReviewFeedback } from "@physifun/domain";

/**
 * UpdateProjectDraftUseCase のポートインターフェース
 *
 * インフラ層で実装する。
 */
export interface UpdateProjectDraftPort {
  /** プロジェクトID で Project 集約を取得する */
  findProjectById(projectId: string): Promise<Project | null>;

  /**
   * Project 集約と（任意の）審査フィードバックをアトミックに永続化する。
   *
   * 自動取下げ時は reviewFeedback が渡される。
   * インフラ層は同一トランザクション内で両方を保存すること。
   */
  saveProjectWithOptionalFeedback(params: {
    project: Project;
    reviewFeedback?: ProjectReviewFeedback;
  }): Promise<void>;
}
