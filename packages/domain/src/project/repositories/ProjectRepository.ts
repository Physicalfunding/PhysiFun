import type { AccountId } from "../../account/value-objects/AccountId";
import type { Project } from "../entities/Project";
import type { ProjectId } from "../value-objects/ProjectId";
import type { PublishStatus } from "../value-objects/PublishStatus";

/**
 * Project Repository インターフェース
 */
export interface ProjectRepository {
  save(project: Project): Promise<void>;
  findById(id: ProjectId): Promise<Project | null>;
  countByOwner(accountId: AccountId, statuses: readonly PublishStatus[]): Promise<number>;
}
