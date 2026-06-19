import { db } from "../database/kysely/client";

/**
 * admin_accounts の email ルックアップ（Prisma 版からの移行 / #224）
 *
 * `isActiveAdminByEmail` / `findAdminAccountIdByEmail` の drop-in。
 * email は呼び出し側の正規化漏れに備え trim + lowercase で二重正規化する (#157 H3)。
 */

/**
 * 指定メールアドレスが ACTIVE な AdminAccount として登録されているかを返す (#145 / #157 C1)。
 * - 未登録 / DISABLED -> false、ACTIVE -> true
 */
export async function isActiveAdminByEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const row = await db
    .selectFrom("admin_accounts")
    .select("status")
    .where("email", "=", normalized)
    .executeTakeFirst();
  return row?.status === "ACTIVE";
}

/**
 * 指定メールアドレスに紐づく AdminAccount の id を返す (#146 B-1)。
 * signature invalid 監査ログ書き込みの FK を満たすため、status は無視して id を引く。
 * - 未登録 -> null
 */
export async function findAdminAccountIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const row = await db
    .selectFrom("admin_accounts")
    .select("id")
    .where("email", "=", normalized)
    .executeTakeFirst();
  return row?.id ?? null;
}
