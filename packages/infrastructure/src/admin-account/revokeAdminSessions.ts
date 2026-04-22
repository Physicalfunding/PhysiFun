import { prisma } from "../database/client";

/**
 * 指定 AdminAccount の AdminSession を全て削除する (#148 強制 revoke)。
 *
 * ## 用途
 * - 運営メンバー管理 UI でアカウントを無効化したとき、未失効セッションを
 *   即座に強制 revoke するために呼ぶ。
 * - NextAuth Database 戦略では AdminSession 行の DELETE がそのまま
 *   ログアウトとして反映される (AdminPrismaAdapter.getSessionAndUser 参照)。
 *
 * @returns 削除された AdminSession の件数。監査ログ (metadata.revokedSessionCount)
 *          に載せる前提。0 件でも正常 (= 既にログアウト済み) として扱う。
 */
export async function revokeAdminSessions(adminAccountId: string): Promise<number> {
  const result = await prisma.adminSession.deleteMany({
    where: { adminAccountId },
  });
  return result.count;
}
