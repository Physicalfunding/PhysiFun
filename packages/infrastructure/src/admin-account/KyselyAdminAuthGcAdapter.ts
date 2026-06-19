import { db } from "../database/kysely/client";

/**
 * AdminSession / AdminVerificationToken の GC アダプタ（Prisma 版からの移行 / #224）
 *
 * `PrismaAdminAuthGcAdapter` と同一 API の drop-in。
 * 期限切れ行を両テーブルから単一トランザクションで削除して件数を返す。
 * - AdminAuditLog.adminSessionId は SetNull のため履歴は保持される（schema.prisma 参照）。
 * - `now` の default は call time で `new Date()` を評価する（テストでは固定 Date を渡せる）。
 */
export class KyselyAdminAuthGcAdapter {
  async deleteExpired(now: Date = new Date()): Promise<{
    deletedSessions: number;
    deletedVerificationTokens: number;
  }> {
    let deletedSessions = 0;
    let deletedVerificationTokens = 0;

    await db.transaction().execute(async (trx) => {
      const sessions = await trx
        .deleteFrom("admin_sessions")
        .where("expires", "<", now)
        .executeTakeFirst();
      const tokens = await trx
        .deleteFrom("admin_verification_tokens")
        .where("expires", "<", now)
        .executeTakeFirst();
      deletedSessions = sessions ? Number(sessions.numDeletedRows) : 0;
      deletedVerificationTokens = tokens ? Number(tokens.numDeletedRows) : 0;
    });

    return { deletedSessions, deletedVerificationTokens };
  }
}
