import type { RecruitmentRepository } from "@physifun/domain";
import type { ProjectOwnerPort } from "./ProjectOwnerPort";

/**
 * DeleteRecruitmentUseCase のポートインターフェース
 *
 * `RecruitmentRepository` から必要なメソッドを `Pick` して組む（`02_domain-model.md` §8.2）。
 * インフラ層で実装する。
 */
export type DeleteRecruitmentPort = Pick<RecruitmentRepository, "findById" | "delete"> &
  ProjectOwnerPort;
