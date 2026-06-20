import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAdminKyselyAdapter } from "../../src/admin-account/AdminKyselyAdapter";
import { db } from "../../src/database/kysely/client";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * Kysely 版 NextAuth カスタム Adapter の integration test（#225）
 *
 * 実 PostgreSQL（Testcontainers）に対して、NextAuth v4 Database 戦略の各メソッドが
 * Prisma 版（AdminPrismaAdapter）と同一の入出力・セキュリティ不変条件を満たすことを確認する。
 * - createUser / linkAccount は throw（自動サインアップ・OAuth 禁止）、getUserByAccount は null
 * - getUser / getUserByEmail は ACTIVE のみ、email は trim + lowercase 正規化
 * - createSession → getSessionAndUser は ACTIVE + 未失効のみ JOIN して返す
 * - updateSession は expires 更新、未指定 / 未知トークンは null
 * - verification token は 1 回消費で削除
 */
describe("Kysely AdminKyselyAdapter integration（#225）", () => {
  const prisma = getTestPrisma();
  const adapter = createAdminKyselyAdapter();

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await db.destroy();
    await disconnectTestPrisma();
  });

  async function seedAdmin(params: {
    email: string;
    status?: "ACTIVE" | "DISABLED";
    lastLoginAt?: Date | null;
  }): Promise<{ id: string; email: string }> {
    const row = await prisma.adminAccount.create({
      data: {
        email: params.email,
        status: params.status ?? "ACTIVE",
        lastLoginAt: params.lastLoginAt ?? null,
      },
    });
    return { id: row.id, email: row.email };
  }

  describe("user 系", () => {
    it("createUser は常に throw（自動サインアップ禁止）", async () => {
      await expect(adapter.createUser!(undefined as never)).rejects.toThrow();
    });

    it("linkAccount は throw（OAuth 非対応）", async () => {
      await expect(adapter.linkAccount!(undefined as never)).rejects.toThrow();
    });

    it("getUserByAccount は常に null", async () => {
      expect(await adapter.getUserByAccount!(undefined as never)).toBeNull();
    });

    it("getUser は ACTIVE を返し DISABLED / 未登録は null。lastLoginAt が emailVerified に載る", async () => {
      const lastLoginAt = new Date("2026-05-01T00:00:00.000Z");
      const active = await seedAdmin({ email: "active@example.com", lastLoginAt });
      const disabled = await seedAdmin({ email: "disabled@example.com", status: "DISABLED" });

      const user = await adapter.getUser!(active.id);
      expect(user).not.toBeNull();
      expect(user!.email).toBe("active@example.com");
      expect(user!.emailVerified?.getTime()).toBe(lastLoginAt.getTime());

      expect(await adapter.getUser!(disabled.id)).toBeNull();
      expect(await adapter.getUser!(randomUUID())).toBeNull();
    });

    it("getUserByEmail は大文字混在を正規化し ACTIVE のみ返す", async () => {
      await seedAdmin({ email: "case@example.com" });
      await seedAdmin({ email: "off@example.com", status: "DISABLED" });

      const user = await adapter.getUserByEmail!("Case@Example.COM");
      expect(user?.email).toBe("case@example.com");

      expect(await adapter.getUserByEmail!("off@example.com")).toBeNull();
      expect(await adapter.getUserByEmail!("ghost@example.com")).toBeNull();
    });

    it("updateUser は ACTIVE を返し DISABLED / 未登録は throw", async () => {
      const active = await seedAdmin({ email: "u-active@example.com" });
      const disabled = await seedAdmin({ email: "u-disabled@example.com", status: "DISABLED" });

      const user = await adapter.updateUser!({ id: active.id });
      expect(user.id).toBe(active.id);
      expect(user.email).toBe("u-active@example.com");

      await expect(adapter.updateUser!({ id: disabled.id })).rejects.toThrow();
      await expect(adapter.updateUser!({ id: randomUUID() })).rejects.toThrow();
    });
  });

  describe("session 系", () => {
    it("createSession → getSessionAndUser で session + ACTIVE user を返す", async () => {
      const admin = await seedAdmin({ email: "s@example.com" });
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      const created = await adapter.createSession!({
        sessionToken: "tok-1",
        userId: admin.id,
        expires,
      });
      expect(created.userId).toBe(admin.id);
      expect(created.expires.getTime()).toBe(expires.getTime());

      // 行が永続化され、id / updatedAt が補完されている
      const persisted = await db
        .selectFrom("admin_sessions")
        .select(["id", "adminAccountId", "updatedAt"])
        .where("sessionToken", "=", "tok-1")
        .executeTakeFirstOrThrow();
      expect(persisted.adminAccountId).toBe(admin.id);
      expect(persisted.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(persisted.updatedAt).toBeInstanceOf(Date);

      const result = await adapter.getSessionAndUser!("tok-1");
      expect(result).not.toBeNull();
      expect(result!.session.sessionToken).toBe("tok-1");
      expect(result!.session.userId).toBe(admin.id);
      expect(result!.user.email).toBe("s@example.com");
    });

    it("getSessionAndUser は失効済み / DISABLED アカウント / 未知トークンで null", async () => {
      const admin = await seedAdmin({ email: "s2@example.com" });
      await adapter.createSession!({
        sessionToken: "expired",
        userId: admin.id,
        expires: new Date(Date.now() - 1000),
      });
      expect(await adapter.getSessionAndUser!("expired")).toBeNull();

      const disabledAdmin = await seedAdmin({ email: "s3@example.com", status: "DISABLED" });
      await adapter.createSession!({
        sessionToken: "disabled-sess",
        userId: disabledAdmin.id,
        expires: new Date(Date.now() + 60_000),
      });
      expect(await adapter.getSessionAndUser!("disabled-sess")).toBeNull();

      expect(await adapter.getSessionAndUser!("ghost")).toBeNull();
    });

    it("updateSession は expires を更新して返す。expires 無指定 / 未知トークンは null", async () => {
      const admin = await seedAdmin({ email: "s4@example.com" });
      await adapter.createSession!({
        sessionToken: "upd",
        userId: admin.id,
        expires: new Date(Date.now() + 60_000),
      });

      const newExpires = new Date(Date.now() + 7_200_000);
      const updated = await adapter.updateSession!({ sessionToken: "upd", expires: newExpires });
      expect(updated?.expires.getTime()).toBe(newExpires.getTime());
      expect(updated?.userId).toBe(admin.id);

      // expires 未指定は no-op で null
      expect(await adapter.updateSession!({ sessionToken: "upd" })).toBeNull();
      // 未知トークンは P2025 を投げず null
      expect(
        await adapter.updateSession!({ sessionToken: "ghost", expires: newExpires })
      ).toBeNull();
    });

    it("deleteSession は対象を削除し、未知トークンでも throw しない", async () => {
      const admin = await seedAdmin({ email: "s5@example.com" });
      await adapter.createSession!({
        sessionToken: "del",
        userId: admin.id,
        expires: new Date(Date.now() + 60_000),
      });

      await adapter.deleteSession!("del");
      expect(await adapter.getSessionAndUser!("del")).toBeNull();

      // 未知トークンでも例外を投げない（deleteMany 相当）
      await expect(adapter.deleteSession!("ghost")).resolves.toBeUndefined();
    });
  });

  describe("verification token 系", () => {
    it("createVerificationToken は identifier を正規化して保存する", async () => {
      const expires = new Date(Date.now() + 600_000);
      const created = await adapter.createVerificationToken!({
        identifier: "Verify@Example.COM",
        token: "vt-1",
        expires,
      });
      expect(created?.identifier).toBe("verify@example.com");

      const row = await db
        .selectFrom("admin_verification_tokens")
        .select(["identifier", "token"])
        .where("token", "=", "vt-1")
        .executeTakeFirstOrThrow();
      expect(row.identifier).toBe("verify@example.com");
    });

    it("useVerificationToken は 1 回で消費し削除する（2 回目は null）", async () => {
      const expires = new Date(Date.now() + 600_000);
      await adapter.createVerificationToken!({
        identifier: "consume@example.com",
        token: "vt-2",
        expires,
      });

      // 大文字混在でも正規化して消費できる
      const first = await adapter.useVerificationToken!({
        identifier: "Consume@Example.com",
        token: "vt-2",
      });
      expect(first?.token).toBe("vt-2");

      const second = await adapter.useVerificationToken!({
        identifier: "consume@example.com",
        token: "vt-2",
      });
      expect(second).toBeNull();
    });

    it("未知の identifier / token は null", async () => {
      expect(
        await adapter.useVerificationToken!({ identifier: "none@example.com", token: "nope" })
      ).toBeNull();
    });
  });
});
