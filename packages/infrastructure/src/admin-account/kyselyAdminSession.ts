import type { AdminAccount } from "@physifun/domain";
import { db } from "../database/kysely/client";

/**
 * 指定 AdminAccount の AdminSession を全て削除する (#148 強制 revoke)。Prisma 版の drop-in。
 *
 * @returns 削除された AdminSession の件数（監査ログ metadata.revokedSessionCount 用）。
 */
export async function revokeAdminSessions(adminAccountId: string): Promise<number> {
  const result = await db
    .deleteFrom("admin_sessions")
    .where("adminAccountId", "=", adminAccountId)
    .executeTakeFirst();
  return result ? Number(result.numDeletedRows) : 0;
}

/**
 * AdminAccount の DISABLED 永続化と AdminSession 全件削除を単一トランザクションで実行する
 * 複合操作（Prisma 版からの移行 / #224、#148 / PR #164 Blocker B-1）。
 *
 * - 引数の集約は `DISABLED` 状態まで遷移済み前提で受け取る（不変条件は集約 `disable()` 側で担保）。
 * - admin_accounts の status / updatedAt 等を更新し、対象の admin_sessions を全件 DELETE。
 * - 失敗時は両操作ともロールバックされ、呼び出し側に例外が伝播する。
 */
export async function disableAdminAccountAndRevokeSessions(
  adminAccount: AdminAccount
): Promise<{ revokedSessionCount: number }> {
  const id = adminAccount.id.toString();
  let revokedSessionCount = 0;

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("admin_accounts")
      .set({
        email: adminAccount.email.toString(),
        status: adminAccount.status,
        lastLoginAt: adminAccount.lastLoginAt,
        updatedAt: adminAccount.updatedAt,
      })
      .where("id", "=", id)
      .execute();

    const result = await trx
      .deleteFrom("admin_sessions")
      .where("adminAccountId", "=", id)
      .executeTakeFirst();
    revokedSessionCount = result ? Number(result.numDeletedRows) : 0;
  });

  return { revokedSessionCount };
}
