import type { AdminAccount } from "@physifun/domain";
import { prisma } from "../database/client";

/**
 * AdminAccount の DISABLED 永続化と AdminSession 全件削除を
 * 単一トランザクションで実行する複合操作 (#148 / PR #164 Blocker B-1)。
 *
 * ## 背景
 * 無効化 API は従来 `repo.update(target)` → `revokeAdminSessions(id)` の
 * 2 本の独立クエリで構成されていたため、前者の成功後に後者が落ちると
 * 「DB 上は DISABLED なのにセッションが生き続ける」整合性崩れが発生し得た。
 * 本アダプタで両クエリを `prisma.$transaction` に束ねてアトミック化する。
 *
 * ## 責務
 * - 引数の `AdminAccount` 集約を `DISABLED` 状態まで遷移済み前提で受け取る
 *   (自己無効化ガード等の不変条件チェックは集約メソッド `disable()` 側で済ませる)
 * - `admin_accounts` 行の `status` / `updatedAt` を更新
 * - 対象 `adminAccountId` の `admin_sessions` を全件 DELETE
 * - 削除件数を返却 (監査ログ `metadata.revokedSessionCount` 用)
 *
 * トランザクションが失敗した場合は両操作ともロールバックされ、呼び出し側には
 * 例外が伝播する (Route Handler 側で 500 に丸める運用)。
 */
export async function disableAdminAccountAndRevokeSessions(
  adminAccount: AdminAccount
): Promise<{ revokedSessionCount: number }> {
  const id = adminAccount.id.toString();

  const [, revoked] = await prisma.$transaction([
    prisma.adminAccount.update({
      where: { id },
      data: {
        email: adminAccount.email.toString(),
        status: adminAccount.status,
        lastLoginAt: adminAccount.lastLoginAt,
        updatedAt: adminAccount.updatedAt,
      },
    }),
    prisma.adminSession.deleteMany({
      where: { adminAccountId: id },
    }),
  ]);

  return { revokedSessionCount: revoked.count };
}
