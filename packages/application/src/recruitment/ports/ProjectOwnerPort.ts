import type { AccountId, ProjectId } from "@physifun/domain";

/**
 * 募集のユースケースが所有者チェックに使うポート（募集の port すべてで共通）
 *
 * インフラ層で実装する。
 */
export interface ProjectOwnerPort {
  /** プロジェクトの所有者（`ownerAccountId`）を返す。プロジェクトが無ければ null。 */
  findProjectOwner(projectId: ProjectId): Promise<AccountId | null>;
}
