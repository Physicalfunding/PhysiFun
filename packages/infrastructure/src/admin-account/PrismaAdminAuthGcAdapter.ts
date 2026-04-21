import { prisma } from "../database/client";

/**
 * AdminSession / AdminVerificationToken の GC アダプタ (#158 M2)
 *
 * NextAuth v4 Database 戦略では「期限切れ行の自動削除」を行わないため、
 * admin_sessions.expires / admin_verification_tokens.expires を過ぎた行が
 * 残り続ける。運用面ではログアウト扱いだが、放置すると DB サイズが膨らみ、
 * 監査 / 調査時にもノイズになるため cron で定期削除する。
 *
 * - `deleteExpired()` は現在時刻より expires が過去の行を両テーブルから削除
 * - AdminAuditLog.adminSessionId は SetNull のため履歴は保持される (schema.prisma 参照)
 */
export class PrismaAdminAuthGcAdapter {
  /**
   * 期限切れ行を両テーブルから削除して件数を返す。
   *
   * `now` の default は「呼び出しごとに `new Date()` を評価」する。
   * JavaScript の default parameter は call time で評価されるため、
   * module load 時の値で固定されることはない (#159 L-5)。
   * テストでは固定 Date を渡すことで再現性を担保できる。
   */
  async deleteExpired(now: Date = new Date()): Promise<{
    deletedSessions: number;
    deletedVerificationTokens: number;
  }> {
    const [sessions, tokens] = await prisma.$transaction([
      prisma.adminSession.deleteMany({
        where: { expires: { lt: now } },
      }),
      prisma.adminVerificationToken.deleteMany({
        where: { expires: { lt: now } },
      }),
    ]);
    return {
      deletedSessions: sessions.count,
      deletedVerificationTokens: tokens.count,
    };
  }
}
