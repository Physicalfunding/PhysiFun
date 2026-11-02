import { AccountId, type ProjectId } from "@physifun/domain";
import { db } from "../database/kysely/client";

/**
 * プロジェクトの所有者（`ownerAccountId`）を返す。プロジェクトが無ければ null。
 *
 * application の `ProjectOwnerPort` の実装。募集のユースケース（`KyselyRecruitmentRepository`）と
 * ストーリーの画像アップロード（#319）で共通に使う。
 */
export async function findProjectOwner(projectId: ProjectId): Promise<AccountId | null> {
  const row = await db
    .selectFrom("projects")
    .select("ownerAccountId")
    .where("id", "=", projectId.toString())
    .executeTakeFirst();
  if (!row) return null;

  const accountIdResult = AccountId.from(row.ownerAccountId);
  if (!accountIdResult.ok) throw new Error(`Invalid AccountId: ${row.ownerAccountId}`);
  return accountIdResult.value;
}
