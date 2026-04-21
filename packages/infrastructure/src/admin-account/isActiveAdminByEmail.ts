import { prisma } from "../database/client";

/**
 * 指定メールアドレスが ACTIVE な AdminAccount として登録されているかを返す (#145 / #157 C1 対応)
 *
 * NextAuth EmailProvider の signIn フローは getUserByEmail が null でも
 * 合成ユーザを作って sendVerificationRequest まで流してしまうため、
 * `callbacks.signIn` で早期に弾くためのチェックとして用いる。
 *
 * - 未登録 email -> false
 * - DISABLED -> false (無効化済みアカウントへのマジックリンク送信を阻止)
 * - ACTIVE -> true
 */
export async function isActiveAdminByEmail(email: string): Promise<boolean> {
  // 呼び出し側が正規化し忘れた場合の保険として二重で正規化する (#157 H3)。
  // AdminAccount.email は seed 時点で lowercase 保存。
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const row = await prisma.adminAccount.findUnique({
    where: { email: normalized },
    select: { status: true },
  });
  return row?.status === "ACTIVE";
}
