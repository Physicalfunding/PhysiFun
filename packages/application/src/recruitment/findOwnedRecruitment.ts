import {
  type AccountId,
  type RecruitmentRepository,
  type Result,
  type SupportRecruitment,
  type SupportRecruitmentId,
  err,
  ok,
} from "@physifun/domain";
import type { ProjectOwnerPort } from "./ports/ProjectOwnerPort";

/**
 * findOwnedRecruitment のエラー型
 */
export type FindOwnedRecruitmentError =
  | { readonly type: "RECRUITMENT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" };

/**
 * 募集を日程ごと取得し、操作するアカウントがそのプロジェクトの所有者かを確かめる。
 *
 * 募集の更新・削除と日程の追加・変更・削除で共通の前段。
 */
export async function findOwnedRecruitment(
  port: Pick<RecruitmentRepository, "findById"> & ProjectOwnerPort,
  recruitmentId: SupportRecruitmentId,
  accountId: AccountId
): Promise<Result<SupportRecruitment, FindOwnedRecruitmentError>> {
  const recruitment = await port.findById(recruitmentId);
  if (!recruitment) {
    return err({ type: "RECRUITMENT_NOT_FOUND" });
  }

  // 募集はプロジェクトに外部キー（ON DELETE CASCADE）でつながるので、所有者が引けないのは
  // 取得の直後にプロジェクトが消されたときだけ。その場合は募集も無いものとして扱う
  const ownerAccountId = await port.findProjectOwner(recruitment.projectId);
  if (!ownerAccountId) {
    return err({ type: "RECRUITMENT_NOT_FOUND" });
  }
  if (!ownerAccountId.equals(accountId)) {
    return err({ type: "NOT_OWNER" });
  }

  return ok(recruitment);
}
