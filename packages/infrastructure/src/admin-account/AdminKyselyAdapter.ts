import { randomUUID } from "node:crypto";
import type { Adapter, AdapterUser, AdapterSession } from "next-auth/adapters";
import { db } from "../database/kysely/client";

/**
 * NextAuth v4 カスタム Adapter（AdminAccount 用 / Kysely 実装 / #225）
 *
 * `createAdminPrismaAdapter`（AdminPrismaAdapter.ts）の drop-in 置換。Prisma 依存を
 * infrastructure 層の Adapter 単位で外す Epic #221 の一環で、入出力・セキュリティ不変条件は
 * Prisma 版と同一に保つ（Prisma 撤去は #230）。
 *
 * 運営管理アプリ (apps/admin) の NextAuth は Database 戦略 + EmailProvider で
 * admin_accounts / admin_sessions / admin_verification_tokens を読み書きする。
 *
 * - `createUser` は必ず throw する（運営者は seed / 運営 UI からのみ追加する）。
 *   マジックリンクで存在しないメールに対する自動サインアップを禁止するため。
 * - `getUser` / `getUserByEmail` は ACTIVE な AdminAccount のみ返す。DISABLED / 未登録は null。
 *   (NextAuth は null を返すと createUser にフォールバックするが、createUser が throw するので
 *    結果的にログイン不能になる)
 * - `deleteSession` は監査上の強制 revoke 経路として維持する。
 * - OAuth 系 (linkAccount / getUserByAccount) は EmailProvider 専用なので未サポートで throw / null。
 *
 * ## Prisma 版との実装差分（挙動は同一・永続化都合のみ）
 * - `id` は Prisma の `@default(uuid())`（アプリ側生成）相当として randomUUID で付与する
 *   （admin_sessions.id に DB DEFAULT は無い）。
 * - `createdAt` は DB DEFAULT（now()）に委ね、`updatedAt` は Prisma `@updatedAt` 相当として明示設定する。
 * - `updateSession` は対象不在時に Prisma `update` が P2025 を throw していたのに対し、RETURNING の
 *   0 件で null を返す（NextAuth の `AdapterSession | null` 契約に沿い、並行 revoke 時の 500 化を避ける。
 *   `updateUser` の #157 H2 と同趣旨）。
 */
export function createAdminKyselyAdapter(): Adapter {
  return {
    async createUser(): Promise<AdapterUser> {
      // 運営アカウントは seed / 運営 UI 経由でのみ作成する (#145)。
      // EmailProvider で未知のメールからのサインアップを全面禁止。
      throw new Error(
        "[AdminKyselyAdapter] createUser is not supported; AdminAccount must be provisioned explicitly."
      );
    },

    async getUser(id: string): Promise<AdapterUser | null> {
      const row = await db
        .selectFrom("admin_accounts")
        .select(["id", "email", "status", "lastLoginAt"])
        .where("id", "=", id)
        .executeTakeFirst();
      if (!row || row.status !== "ACTIVE") return null;
      return toAdapterUser(row);
    },

    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      // 大文字違いでマッチ漏れしないよう正規化 (#157 H3)
      const normalized = email.trim().toLowerCase();
      const row = await db
        .selectFrom("admin_accounts")
        .select(["id", "email", "status", "lastLoginAt"])
        .where("email", "=", normalized)
        .executeTakeFirst();
      if (!row || row.status !== "ACTIVE") return null;
      return toAdapterUser(row);
    },

    async getUserByAccount(): Promise<AdapterUser | null> {
      // OAuth を使わないため常に null (NextAuth は null の場合次のフローに進む)。
      return null;
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<AdapterUser> {
      // EmailProvider では name/image 等の上書きは発生しない想定。
      // 実更新は行わず、存在しない/非 ACTIVE の場合は throw を返す (#157 H2)。
      const row = await db
        .selectFrom("admin_accounts")
        .select(["id", "email", "status", "lastLoginAt"])
        .where("id", "=", user.id)
        .executeTakeFirst();
      if (!row || row.status !== "ACTIVE") {
        throw new Error("[AdminKyselyAdapter] updateUser target not found or not ACTIVE");
      }
      return toAdapterUser(row);
    },

    async linkAccount() {
      throw new Error("[AdminKyselyAdapter] linkAccount is not supported.");
    },

    async createSession(params: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }): Promise<AdapterSession> {
      await db
        .insertInto("admin_sessions")
        .values({
          // id / updatedAt は Prisma 側生成だったため Kysely では明示する (createdAt は DB DEFAULT)。
          id: randomUUID(),
          sessionToken: params.sessionToken,
          adminAccountId: params.userId,
          expires: params.expires,
          updatedAt: new Date(),
        })
        .execute();
      return {
        sessionToken: params.sessionToken,
        userId: params.userId,
        expires: params.expires,
      };
    },

    async getSessionAndUser(
      sessionToken: string
    ): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const row = await db
        .selectFrom("admin_sessions")
        .innerJoin("admin_accounts", "admin_accounts.id", "admin_sessions.adminAccountId")
        .select([
          "admin_sessions.sessionToken as sessionToken",
          "admin_sessions.adminAccountId as adminAccountId",
          "admin_sessions.expires as expires",
          "admin_accounts.id as userId",
          "admin_accounts.email as email",
          "admin_accounts.status as status",
          "admin_accounts.lastLoginAt as lastLoginAt",
        ])
        .where("admin_sessions.sessionToken", "=", sessionToken)
        .executeTakeFirst();
      if (!row) return null;
      // DISABLED な AdminAccount のセッションは強制失効扱い。
      if (row.status !== "ACTIVE") return null;
      // 期限切れセッションは NextAuth 側でも弾くが、ここでも早期に null。
      if (row.expires.getTime() <= Date.now()) return null;
      return {
        session: {
          sessionToken: row.sessionToken,
          userId: row.adminAccountId,
          expires: row.expires,
        },
        user: toAdapterUser({ id: row.userId, email: row.email, lastLoginAt: row.lastLoginAt }),
      };
    },

    async updateSession(params: {
      sessionToken: string;
      expires?: Date;
    }): Promise<AdapterSession | null> {
      if (!params.expires) return null;
      const row = await db
        .updateTable("admin_sessions")
        .set({ expires: params.expires, updatedAt: new Date() })
        .where("sessionToken", "=", params.sessionToken)
        .returning(["sessionToken", "adminAccountId", "expires"])
        .executeTakeFirst();
      if (!row) return null;
      return {
        sessionToken: row.sessionToken,
        userId: row.adminAccountId,
        expires: row.expires,
      };
    },

    async deleteSession(sessionToken: string): Promise<void> {
      await db.deleteFrom("admin_sessions").where("sessionToken", "=", sessionToken).execute();
    },

    async createVerificationToken(params: { identifier: string; token: string; expires: Date }) {
      // identifier (= email) を正規化して保存 (#157 H3)。大文字違いで token 検索が漏れないよう。
      const identifier = params.identifier.trim().toLowerCase();
      await db
        .insertInto("admin_verification_tokens")
        .values({ identifier, token: params.token, expires: params.expires })
        .execute();
      return { identifier, token: params.token, expires: params.expires };
    },

    async useVerificationToken(params: { identifier: string; token: string }) {
      // 1 回消費したら削除 (NextAuth v4 の仕様)。未知 / 消費済みは null。
      const identifier = params.identifier.trim().toLowerCase();
      const row = await db
        .deleteFrom("admin_verification_tokens")
        .where("identifier", "=", identifier)
        .where("token", "=", params.token)
        .returning(["identifier", "token", "expires"])
        .executeTakeFirst();
      if (!row) return null;
      return { identifier: row.identifier, token: row.token, expires: row.expires };
    },
  };
}

function toAdapterUser(row: { id: string; email: string; lastLoginAt: Date | null }): AdapterUser {
  return {
    id: row.id,
    email: row.email,
    // AdminAccount は seed 時点で verify 済み扱い。NextAuth の型要件を満たすためのダミー。
    emailVerified: row.lastLoginAt ?? null,
    name: null,
    image: null,
  };
}
