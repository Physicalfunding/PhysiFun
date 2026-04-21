import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Route Handler / Server Component 用の運営認証ヘルパー (#145)
 *
 * Database 戦略に切り替えた結果、JWT の roles ブリッジは廃止。
 * `getServerSession` は AdminPrismaAdapter.getSessionAndUser を経由するため、
 * 呼び出し時点で AdminSession 行削除 / AdminAccount DISABLED 化が反映される
 * (= 強制 revoke がそのまま効く)。
 *
 * @returns AdminAccount.id。セッションが無い / 失効している場合は null。
 */
export async function getAuthenticatedAdminId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}
