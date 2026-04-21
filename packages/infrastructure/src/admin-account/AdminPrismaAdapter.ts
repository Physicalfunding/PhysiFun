import type { Adapter, AdapterUser, AdapterSession } from "next-auth/adapters";
import { prisma } from "../database/client";

/**
 * NextAuth v4 カスタム Adapter (AdminAccount 用 / #145)
 *
 * 運営管理アプリ (apps/admin) の NextAuth は Database 戦略 + EmailProvider で
 * AdminAccount / AdminSession / AdminVerificationToken テーブルを読み書きする。
 *
 * - `createUser` は必ず throw する（運営者は seed / UI からのみ追加する）。
 *   マジックリンクで存在しないメールに対する自動サインアップを禁止するため。
 * - `getUserByEmail` は ACTIVE な AdminAccount のみ返す。DISABLED は null。
 *   (NextAuth は null を返すと createUser にフォールバックするが、createUser が
 *    throw するので結果的にログイン不能になる)
 * - `deleteSession` は監査上の強制 revoke 経路として維持する。
 * - OAuth 系 (linkAccount / getUserByAccount / unlinkAccount) は EmailProvider 専用
 *   なので未サポートで throw。
 */
export function createAdminPrismaAdapter(): Adapter {
  return {
    async createUser(): Promise<AdapterUser> {
      // 運営アカウントは seed / 運営 UI 経由でのみ作成する (#145)。
      // EmailProvider で未知のメールからのサインアップを全面禁止。
      throw new Error(
        "[AdminPrismaAdapter] createUser is not supported; AdminAccount must be provisioned explicitly."
      );
    },

    async getUser(id: string): Promise<AdapterUser | null> {
      const row = await prisma.adminAccount.findUnique({ where: { id } });
      if (!row) return null;
      if (row.status !== "ACTIVE") return null;
      return toAdapterUser(row);
    },

    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const row = await prisma.adminAccount.findUnique({ where: { email } });
      if (!row) return null;
      if (row.status !== "ACTIVE") return null;
      return toAdapterUser(row);
    },

    async getUserByAccount(): Promise<AdapterUser | null> {
      // OAuth を使わないため常に null (NextAuth は null の場合次のフローに進む)。
      return null;
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<AdapterUser> {
      // EmailProvider では name/image 等の上書きは発生しない想定だが、
      // NextAuth 内部から呼ばれる経路があるため最小更新 (updatedAt のみ) を実装する。
      const row = await prisma.adminAccount.update({
        where: { id: user.id },
        data: {},
      });
      return toAdapterUser(row);
    },

    async linkAccount() {
      throw new Error("[AdminPrismaAdapter] linkAccount is not supported.");
    },

    async createSession(params: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }): Promise<AdapterSession> {
      const row = await prisma.adminSession.create({
        data: {
          sessionToken: params.sessionToken,
          adminAccountId: params.userId,
          expires: params.expires,
        },
      });
      return {
        sessionToken: row.sessionToken,
        userId: row.adminAccountId,
        expires: row.expires,
      };
    },

    async getSessionAndUser(
      sessionToken: string
    ): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const row = await prisma.adminSession.findUnique({
        where: { sessionToken },
        include: { adminAccount: true },
      });
      if (!row) return null;
      // DISABLED な AdminAccount のセッションは強制失効扱い。
      if (row.adminAccount.status !== "ACTIVE") return null;
      // 期限切れセッションは NextAuth 側でも弾くが、ここでも早期に null。
      if (row.expires.getTime() <= Date.now()) return null;
      return {
        session: {
          sessionToken: row.sessionToken,
          userId: row.adminAccountId,
          expires: row.expires,
        },
        user: toAdapterUser(row.adminAccount),
      };
    },

    async updateSession(params: {
      sessionToken: string;
      expires?: Date;
    }): Promise<AdapterSession | null> {
      if (!params.expires) return null;
      const row = await prisma.adminSession.update({
        where: { sessionToken: params.sessionToken },
        data: { expires: params.expires },
      });
      return {
        sessionToken: row.sessionToken,
        userId: row.adminAccountId,
        expires: row.expires,
      };
    },

    async deleteSession(sessionToken: string): Promise<void> {
      await prisma.adminSession.deleteMany({ where: { sessionToken } });
    },

    async createVerificationToken(params: {
      identifier: string;
      token: string;
      expires: Date;
    }) {
      const row = await prisma.adminVerificationToken.create({
        data: {
          identifier: params.identifier,
          token: params.token,
          expires: params.expires,
        },
      });
      return {
        identifier: row.identifier,
        token: row.token,
        expires: row.expires,
      };
    },

    async useVerificationToken(params: { identifier: string; token: string }) {
      // 1 回消費したら削除 (NextAuth v4 の仕様)。
      try {
        const row = await prisma.adminVerificationToken.delete({
          where: {
            identifier_token: {
              identifier: params.identifier,
              token: params.token,
            },
          },
        });
        return {
          identifier: row.identifier,
          token: row.token,
          expires: row.expires,
        };
      } catch {
        // 未知のトークン / 既に消費済み。
        return null;
      }
    },
  };
}

function toAdapterUser(row: {
  id: string;
  email: string;
  lastLoginAt: Date | null;
}): AdapterUser {
  return {
    id: row.id,
    email: row.email,
    // AdminAccount は seed 時点で verify 済み扱い。NextAuth の型要件を満たすためのダミー。
    emailVerified: row.lastLoginAt ?? null,
    name: null,
    image: null,
  };
}
