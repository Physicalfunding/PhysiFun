import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  AdminAccount,
  AdminAccountEmail,
  AdminAccountId,
  AdminAccountStatus,
} from "@physifun/domain";
import { KyselyAdminAccountRepository } from "../../src/admin-account/KyselyAdminAccountRepository";
import { KyselyAdminAuditLogQueryService } from "../../src/admin-account/KyselyAdminAuditLogQueryService";
import { writeAdminAuditLog } from "../../src/admin-account/KyselyAdminAuditLogAdapter";
import { KyselyAdminAuthGcAdapter } from "../../src/admin-account/KyselyAdminAuthGcAdapter";
import {
  findAdminAccountIdByEmail,
  isActiveAdminByEmail,
} from "../../src/admin-account/kyselyAdminAccountLookup";
import {
  disableAdminAccountAndRevokeSessions,
  revokeAdminSessions,
} from "../../src/admin-account/kyselyAdminSession";
import { db } from "../../src/database/kysely/client";
import { isUniqueConstraintError } from "../../src/database/isUniqueConstraintError";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * Kysely 版 admin-account 実装の integration test（#224）
 *
 * - シードは Prisma（既存ヘルパー）と Kysely writeAdminAuditLog、検証対象は Kysely 実装。
 * - 実 PostgreSQL（Testcontainers）に対して、リポジトリ CRUD / ページネーション・
 *   監査ログのフィルタ + JOIN + distinct・GC / 無効化の batched tx が Prisma 版と同じ結果に
 *   なることを確認する。
 */
describe("Kysely admin-account 実装 integration", () => {
  const prisma = getTestPrisma();
  const repo = new KyselyAdminAccountRepository();
  const auditQs = new KyselyAdminAuditLogQueryService();
  const gc = new KyselyAdminAuthGcAdapter();

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await db.destroy();
    await disconnectTestPrisma();
  });

  function adminId(id: string): AdminAccountId {
    const r = AdminAccountId.from(id);
    if (!r.ok) throw new Error(`invalid admin id in test: ${id}`);
    return r.value;
  }

  function adminEmail(email: string): AdminAccountEmail {
    const r = AdminAccountEmail.from(email);
    if (!r.ok) throw new Error(`invalid admin email in test: ${email}`);
    return r.value;
  }

  function buildAdminAccount(params: {
    id?: string;
    email: string;
    status?: AdminAccountStatus;
    lastLoginAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): AdminAccount {
    const idResult = AdminAccountId.from(params.id ?? randomUUID());
    if (!idResult.ok) throw new Error("invalid id in test");
    const emailResult = AdminAccountEmail.from(params.email);
    if (!emailResult.ok) throw new Error("invalid email in test");
    const ts = params.createdAt ?? new Date("2026-01-01T00:00:00Z");
    return AdminAccount.reconstruct({
      id: idResult.value,
      email: emailResult.value,
      status: params.status ?? AdminAccountStatus.ACTIVE,
      lastLoginAt: params.lastLoginAt ?? null,
      createdAt: ts,
      updatedAt: params.updatedAt ?? ts,
    });
  }

  describe("AdminAccountRepository", () => {
    it("create で永続化し、findById / findByEmail で復元できる", async () => {
      const id = randomUUID();
      const account = buildAdminAccount({ id, email: "repo@example.com" });
      await repo.create(account);

      const byId = await repo.findById(adminId(id));
      expect(byId).not.toBeNull();
      expect(byId!.email.toString()).toBe("repo@example.com");
      expect(byId!.status).toBe(AdminAccountStatus.ACTIVE);

      const byEmail = await repo.findByEmail(adminEmail("repo@example.com"));
      expect(byEmail!.id.toString()).toBe(id);
    });

    it("同一 email の二重 create は pg の一意制約違反 (23505) を送出し isUniqueConstraintError で判定できる", async () => {
      const email = "race@example.com";
      await repo.create(buildAdminAccount({ email }));

      // POST /api/admin/members の findByEmail→create レース条件を模した二重 insert。
      // email unique index に弾かれ、Kysely は pg の DatabaseError(23505) をラップせず送出する。
      let caught: unknown;
      try {
        await repo.create(buildAdminAccount({ email }));
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeDefined();
      expect(isUniqueConstraintError(caught)).toBe(true);
    });

    it("update で status / updatedAt を更新する", async () => {
      const id = randomUUID();
      await repo.create(buildAdminAccount({ id, email: "upd@example.com" }));

      const newUpdatedAt = new Date("2026-03-01T00:00:00Z");
      await repo.update(
        buildAdminAccount({
          id,
          email: "upd@example.com",
          status: AdminAccountStatus.DISABLED,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: newUpdatedAt,
        })
      );

      const row = await db
        .selectFrom("admin_accounts")
        .select(["status", "updatedAt"])
        .where("id", "=", id)
        .executeTakeFirstOrThrow();
      expect(row.status).toBe("DISABLED");
      expect(row.updatedAt.getTime()).toBe(newUpdatedAt.getTime());
    });

    it("findAll は createdAt desc + id desc tie-breaker でページングし totalCount を返す", async () => {
      const sameInstant = new Date("2026-02-01T00:00:00.000Z");
      await prisma.adminAccount.createMany({
        data: Array.from({ length: 6 }, (_, i) => ({
          email: `tie-${i}@example.com`,
          status: "ACTIVE" as const,
          createdAt: sameInstant,
          updatedAt: sameInstant,
        })),
      });

      const page1 = await repo.findAll({ page: 1, perPage: 3 });
      const page2 = await repo.findAll({ page: 2, perPage: 3 });

      expect(page1.totalCount).toBe(6);
      expect(page1.items).toHaveLength(3);
      expect(page2.items).toHaveLength(3);

      const page1Ids = page1.items.map((a) => a.id.toString());
      const page2Ids = page2.items.map((a) => a.id.toString());
      expect(page1Ids.filter((x) => page2Ids.includes(x))).toEqual([]);
      expect(new Set([...page1Ids, ...page2Ids]).size).toBe(6);
      // id desc になっていること（tie-breaker 方向）
      expect(page1Ids).toEqual([...page1Ids].sort().reverse());
    });

    it("空テーブルでは totalCount=0 / items=[]", async () => {
      const result = await repo.findAll({ page: 1, perPage: 10 });
      expect(result.totalCount).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  describe("AuditLog（writeAdminAuditLog + QueryService）", () => {
    async function seedFixture(): Promise<void> {
      const alice = await prisma.adminAccount.create({
        data: { email: "alice@example.com", status: "ACTIVE" },
      });
      const bob = await prisma.adminAccount.create({
        data: { email: "bob@example.com", status: "ACTIVE" },
      });

      await writeAdminAuditLog({
        adminAccountId: alice.id,
        action: "leader_application.approve",
        targetType: "LeaderApplication",
        targetId: "la-1",
        metadata: { reviewerNote: "ok" },
      });
      await writeAdminAuditLog({
        adminAccountId: bob.id,
        action: "project.reject",
        targetType: "Project",
        targetId: "p-1",
        metadata: { reason: "insufficient" },
      });
      await writeAdminAuditLog({
        adminAccountId: alice.id,
        action: "project.approve",
        targetType: "Project",
        targetId: "p-2",
      });
      await writeAdminAuditLog({
        adminAccountId: alice.id,
        action: "project.force_unpublish",
        targetType: "Project",
        targetId: "p-3",
        metadata: null,
      });
    }

    it("createdAt desc で adminEmail を JOIN して返す", async () => {
      await seedFixture();
      const result = await auditQs.findMany({}, { page: 1, perPage: 10 });

      expect(result.totalCount).toBe(4);
      expect(result.items[0].action).toBe("project.force_unpublish");
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
          result.items[i].createdAt.getTime()
        );
      }
      expect(new Set(result.items.map((r) => r.adminEmail))).toEqual(
        new Set(["alice@example.com", "bob@example.com"])
      );
    });

    it("email フィルタ（大文字混在でも小文字正規化）/ action / targetType で絞り込む", async () => {
      await seedFixture();

      const byEmail = await auditQs.findMany(
        { email: "Alice@Example.com" },
        { page: 1, perPage: 10 }
      );
      expect(byEmail.totalCount).toBe(3);
      expect(byEmail.items.every((r) => r.adminEmail === "alice@example.com")).toBe(true);

      const byAction = await auditQs.findMany(
        { action: "leader_application.approve" },
        { page: 1, perPage: 10 }
      );
      expect(byAction.totalCount).toBe(1);

      const byTarget = await auditQs.findMany({ targetType: "Project" }, { page: 1, perPage: 10 });
      expect(byTarget.totalCount).toBe(3);
    });

    it("to は半開区間 [from, to) として最新行を境界で除外/包含する", async () => {
      await seedFixture();
      const all = await auditQs.findMany({}, { page: 1, perPage: 10 });
      const latest = all.items[0];

      const excluded = await auditQs.findMany({ to: latest.createdAt }, { page: 1, perPage: 10 });
      expect(excluded.items.some((r) => r.id === latest.id)).toBe(false);

      const included = await auditQs.findMany(
        { to: new Date(latest.createdAt.getTime() + 1) },
        { page: 1, perPage: 10 }
      );
      expect(included.items.some((r) => r.id === latest.id)).toBe(true);
    });

    it("metadata は object / null / 未指定 を正しく復元する", async () => {
      await seedFixture();
      const all = await auditQs.findMany({}, { page: 1, perPage: 10 });

      expect(all.items.find((r) => r.targetId === "la-1")?.metadata).toEqual({
        reviewerNote: "ok",
      });
      // 明示 null
      expect(all.items.find((r) => r.targetId === "p-3")?.metadata).toBeNull();
      // 未指定（DB NULL）
      expect(all.items.find((r) => r.targetId === "p-2")?.metadata).toBeNull();
    });

    it("listDistinctActions / listDistinctTargetTypes をソート済みで返す", async () => {
      await seedFixture();
      expect(await auditQs.listDistinctActions()).toEqual([
        "leader_application.approve",
        "project.approve",
        "project.force_unpublish",
        "project.reject",
      ]);
      expect(await auditQs.listDistinctTargetTypes()).toEqual(["LeaderApplication", "Project"]);
    });
  });

  describe("AuthGc.deleteExpired", () => {
    it("期限切れの session / token を両テーブルから削除し、新しい行は残す", async () => {
      const admin = await prisma.adminAccount.create({
        data: { email: "gc@example.com", status: "ACTIVE" },
      });
      const now = new Date("2026-06-01T00:00:00Z");

      await prisma.adminSession.createMany({
        data: [
          {
            adminAccountId: admin.id,
            sessionToken: "expired-s",
            expires: new Date("2026-05-01T00:00:00Z"),
          },
          {
            adminAccountId: admin.id,
            sessionToken: "fresh-s",
            expires: new Date("2026-07-01T00:00:00Z"),
          },
        ],
      });
      await prisma.adminVerificationToken.createMany({
        data: [
          {
            identifier: "a@example.com",
            token: "expired-t",
            expires: new Date("2026-05-01T00:00:00Z"),
          },
          {
            identifier: "b@example.com",
            token: "fresh-t",
            expires: new Date("2026-07-01T00:00:00Z"),
          },
        ],
      });

      const result = await gc.deleteExpired(now);
      expect(result).toEqual({ deletedSessions: 1, deletedVerificationTokens: 1 });

      const sessions = await db.selectFrom("admin_sessions").select("sessionToken").execute();
      expect(sessions.map((s) => s.sessionToken)).toEqual(["fresh-s"]);
      const tokens = await db.selectFrom("admin_verification_tokens").select("token").execute();
      expect(tokens.map((t) => t.token)).toEqual(["fresh-t"]);
    });
  });

  describe("lookup（isActiveAdminByEmail / findAdminAccountIdByEmail）", () => {
    it("ACTIVE は true、DISABLED / 未登録 は false。id は status 無視で引ける", async () => {
      const active = await prisma.adminAccount.create({
        data: { email: "active@example.com", status: "ACTIVE" },
      });
      const disabled = await prisma.adminAccount.create({
        data: { email: "disabled@example.com", status: "DISABLED" },
      });

      expect(await isActiveAdminByEmail("Active@Example.com")).toBe(true);
      expect(await isActiveAdminByEmail("disabled@example.com")).toBe(false);
      expect(await isActiveAdminByEmail("ghost@example.com")).toBe(false);

      expect(await findAdminAccountIdByEmail("active@example.com")).toBe(active.id);
      // status 無視で DISABLED も id を引ける
      expect(await findAdminAccountIdByEmail("DISABLED@example.com")).toBe(disabled.id);
      expect(await findAdminAccountIdByEmail("ghost@example.com")).toBeNull();
    });
  });

  describe("session（revokeAdminSessions / disableAdminAccountAndRevokeSessions）", () => {
    it("revokeAdminSessions は対象アカウントの全セッションを削除し件数を返す", async () => {
      const admin = await prisma.adminAccount.create({
        data: { email: "revoke@example.com", status: "ACTIVE" },
      });
      await prisma.adminSession.createMany({
        data: [
          {
            adminAccountId: admin.id,
            sessionToken: "s1",
            expires: new Date("2026-12-01T00:00:00Z"),
          },
          {
            adminAccountId: admin.id,
            sessionToken: "s2",
            expires: new Date("2026-12-01T00:00:00Z"),
          },
        ],
      });

      const count = await revokeAdminSessions(admin.id);
      expect(count).toBe(2);

      const remaining = await db
        .selectFrom("admin_sessions")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("adminAccountId", "=", admin.id)
        .executeTakeFirstOrThrow();
      expect(Number(remaining.count)).toBe(0);
    });

    it("disableAdminAccountAndRevokeSessions は DISABLED 化 + セッション全削除を 1 tx で行う", async () => {
      const operator = await prisma.adminAccount.create({
        data: { email: "operator@example.com", status: "ACTIVE" },
      });
      const target = await prisma.adminAccount.create({
        data: { email: "target@example.com", status: "ACTIVE" },
      });
      await prisma.adminSession.createMany({
        data: [
          {
            adminAccountId: target.id,
            sessionToken: "t1",
            expires: new Date("2026-12-01T00:00:00Z"),
          },
          {
            adminAccountId: target.id,
            sessionToken: "t2",
            expires: new Date("2026-12-01T00:00:00Z"),
          },
        ],
      });

      const aggregate = await repo.findById(adminId(target.id));
      const disableResult = aggregate!.disable({ operatorId: adminId(operator.id) });
      expect(disableResult.ok).toBe(true);

      const { revokedSessionCount } = await disableAdminAccountAndRevokeSessions(aggregate!);
      expect(revokedSessionCount).toBe(2);

      const row = await db
        .selectFrom("admin_accounts")
        .select("status")
        .where("id", "=", target.id)
        .executeTakeFirstOrThrow();
      expect(row.status).toBe("DISABLED");

      const sessions = await db
        .selectFrom("admin_sessions")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("adminAccountId", "=", target.id)
        .executeTakeFirstOrThrow();
      expect(Number(sessions.count)).toBe(0);
    });
  });
});
