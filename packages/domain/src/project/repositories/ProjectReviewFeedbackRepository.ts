import type { ProjectReviewFeedback } from "../entities/ProjectReviewFeedback";
import type { ProjectId } from "../value-objects/ProjectId";

/**
 * ProjectReviewFeedback Repository インターフェース
 */
export interface ProjectReviewFeedbackRepository {
  save(feedback: ProjectReviewFeedback): Promise<void>;
  findLatestByProjectId(projectId: ProjectId): Promise<ProjectReviewFeedback | null>;
}
