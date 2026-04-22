import { prisma } from "../database/client";

/**
 * 指定メールアドレスに紐づく AdminAccount の id を返す (#146 B-1 対応)
 *
 * `apps/admin/src/app/api/auth/[...nextauth]/route.ts` の signature invalid 監査ログ
 * 書き込みで利用する。FK 制約 (`AdminAuditLog.adminAccountId`) を満たすために
 * email から AdminAccount を解決する必要があるが、
 * `infrastructure/` 以外で prisma を直接触らない方針 (CLAUDE.md 禁止事項) に揃えるため
 * インフラ層に関数を切り出している。
 *
 * - 未登録 email -> null (未登録 email への改ざん試行は監査ログへ残さず console.warn のみ)
 * - email は呼び出し側の正規化漏れに備え trim + lowercase で二重正規化する
 *   (`isActiveAdminByEmail` と同じパターン / #157 H3)
 *
 * ## status を無視する理由
 * signature invalid を受け取った時点では、DISABLED 化されたアカウント宛の
 * 攻撃試行も監査記録として残したい。したがって status=ACTIVE のみに絞る
 * `isActiveAdminByEmail` とは要件が異なり、status 無視で id を引く。
 */
export async function findAdminAccountIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const row = await prisma.adminAccount.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  return row?.id ?? null;
}
