import { db } from "../database/kysely/client";

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
 * Kysely を使った期限切れ PENDING_EMAIL_CONFIRMATION アカウント削除アダプタ（#223）
 *
 * `PrismaCleanupExpiredAccountsAdapter` と同一 API の drop-in。
 * Account を削除すると、LeaderApplication は FK の onDelete: Cascade（DB 制約）により
 * 自動的に削除される（Prisma 版と同一挙動）。
 *
 * TODO: 大量データ時はバッチ分割削除を検討する
 */
export class KyselyCleanupExpiredAccountsAdapter implements CleanupExpiredAccountsPort {
  async deleteExpiredPendingAccounts(olderThan: Date): Promise<number> {
    const result = await db
      .deleteFrom("accounts")
      .where("status", "=", "PENDING_EMAIL_CONFIRMATION")
      .where("createdAt", "<", olderThan)
      .executeTakeFirst();
    // pg は削除件数を bigint で返すため number へ変換する。
    return result ? Number(result.numDeletedRows) : 0;
  }
}
