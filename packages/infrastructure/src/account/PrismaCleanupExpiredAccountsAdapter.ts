import { prisma } from "../database/client";

/**
 * 期限切れアカウント削除用のポートインターフェース
 *
 * application 層の CleanupExpiredAccountsPort と同一の型。
 * 循環依存 (infrastructure → application) を避けるためここで定義する。
 */
export interface CleanupExpiredAccountsPort {
  deleteExpiredPendingAccounts(olderThan: Date): Promise<number>;
}

/**
 * Prisma を使った期限切れ PENDING_EMAIL_CONFIRMATION アカウント削除アダプタ
 *
 * Account を deleteMany で削除すると、LeaderApplication は
 * onDelete: Cascade により自動的に削除される。
 *
 * TODO: 大量データ時はバッチ分割削除を検討する
 */
export class PrismaCleanupExpiredAccountsAdapter implements CleanupExpiredAccountsPort {
  async deleteExpiredPendingAccounts(olderThan: Date): Promise<number> {
    const result = await prisma.account.deleteMany({
      where: {
        status: "PENDING_EMAIL_CONFIRMATION",
        createdAt: { lt: olderThan },
      },
    });
    return result.count;
  }
}
