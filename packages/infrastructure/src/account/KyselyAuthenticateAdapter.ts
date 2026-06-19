import { db } from "../database/kysely/client";
import { parsePgEnumArray } from "../database/kysely/pgArray";

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
 * Kysely ベースの認証用アダプタ（Prisma 版からの移行 / #223）
 *
 * `PrismaAuthenticateAdapter` と同一 API の drop-in。
 * UseCase ではなく NextAuth callback から直接使う想定のため、
 * application 層に Port を置かず infrastructure 層内で完結させる。
 *
 * findActiveAccountByEmail: ACTIVE かつ passwordHash を持つアカウントのみ返す。
 * PENDING_EMAIL_CONFIRMATION / passwordHash = null のアカウントはログイン不可のため null。
 */
export class KyselyAuthenticateAdapter {
  async findActiveAccountByEmail(email: string): Promise<AuthenticatedAccount | null> {
    const row = await db
      .selectFrom("accounts")
      .select(["id", "email", "status", "passwordHash", "roles"])
      .where("email", "=", email)
      .executeTakeFirst();
    if (!row) return null;
    if (row.status !== "ACTIVE") return null;
    if (!row.passwordHash) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      // pg はネイティブ enum 配列（roles）を文字列で返すため配列化し、既知ロールのみ通す。
      roles: parsePgEnumArray(row.roles).filter(isAccountRole),
    };
  }
}

const ACCOUNT_ROLES = ["SUPPORTER", "LEADER", "ADMIN"] as const;

function isAccountRole(value: string): value is AccountRole {
  return (ACCOUNT_ROLES as readonly string[]).includes(value);
}
