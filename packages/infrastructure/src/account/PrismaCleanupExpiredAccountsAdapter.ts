import type { CleanupExpiredAccountsPort } from "@physifun/application";
import { prisma } from "../database/client";

/**
 * Prisma を使った期限切れ PENDING_EMAIL_CONFIRMATION アカウント削除アダプタ
 *
 * Account を deleteMany で削除すると、LeaderApplication は
 * onDelete: Cascade により自動的に削除される。
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
