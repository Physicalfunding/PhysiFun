import { prisma } from "../database/client";

export type AccountRole = "SUPPORTER" | "LEADER" | "ADMIN";

/**
 * 認証成功時に返すアカウント情報
 */
export interface AuthenticatedAccount {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly roles: readonly AccountRole[];
}

/**
 * NextAuth authorize から利用する認証用アダプタ
 *
 * UseCase ではなく NextAuth callback から直接使う想定のため、
 * application 層に Port を置かず infrastructure 層内で完結させる。
 *
 * findActiveAccountByEmail: ACTIVE かつ passwordHash を持つアカウントのみ返す。
 * PENDING_EMAIL_CONFIRMATION / passwordHash = null のアカウントはログイン不可のため null。
 */
export class PrismaAuthenticateAdapter {
  async findActiveAccountByEmail(email: string): Promise<AuthenticatedAccount | null> {
    const row = await prisma.account.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
        passwordHash: true,
        roles: true,
      },
    });
    if (!row) return null;
    if (row.status !== "ACTIVE") return null;
    if (!row.passwordHash) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      roles: row.roles.filter(isAccountRole),
    };
  }
}

const ACCOUNT_ROLES = ["SUPPORTER", "LEADER", "ADMIN"] as const;

function isAccountRole(value: string): value is AccountRole {
  return (ACCOUNT_ROLES as readonly string[]).includes(value);
}
