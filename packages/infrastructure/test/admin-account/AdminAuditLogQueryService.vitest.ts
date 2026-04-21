import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaAdminAuditLogQueryService } from "../../src/admin-account/PrismaAdminAuditLogQueryService";
import { writeAdminAuditLog } from "../../src/admin-account/PrismaAdminAuditLogAdapter";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * PrismaAdminAuditLogQueryService の integration test (#149)
 *
 * write 側 (`writeAdminAuditLog`, #145 / #157 H2) と組み合わせて、
 * 実 Postgres で fixture を積んだうえでフィルタ挙動を検証する。
 */
describe("PrismaAdminAuditLogQueryService integration", () => {
  const prisma = getTestPrisma();
  const qs = new PrismaAdminAuditLogQueryService();

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  /**
   * 2 名の AdminAccount + 3 種類の action を 5 件登録するヘルパー。
   * createdAt は Prisma の default(now()) に任せるが、僅差だと順序不定になるため
   * 明示的に `await` で直列化する (writeAdminAuditLog が順序保証してくれる)。
   */
  async function seedFixture(): Promise<{ aliceId: string; bobId: string }> {
    const alice = await prisma.adminAccount.create({
      data: { email: "alice@example.com", status: "ACTIVE" },
    });
    const bob = await prisma.adminAccount.create({
      data: { email: "bob@example.com", status: "ACTIVE" },
    });

    // 意図的にインターリーブして「新しい順」が効いているかを確認できるようにする
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
      metadata: { reason: "insufficient info" },
    });
    await writeAdminAuditLog({
      adminAccountId: alice.id,
      action: "project.approve",
      targetType: "Project",
      targetId: "p-2",
    });
    await writeAdminAuditLog({
      adminAccountId: bob.id,
      action: "leader_application.approve",
      targetType: "LeaderApplication",
      targetId: "la-2",
    });
    await writeAdminAuditLog({
      adminAccountId: alice.id,
      action: "project.force_unpublish",
      targetType: "Project",
      targetId: "p-3",
      metadata: null,
    });

    return { aliceId: alice.id, bobId: bob.id };
  }

  describe("findMany", () => {
    it("新しい順に返る (createdAt desc)", async () => {
      await seedFixture();

      const result = await qs.findMany({}, { page: 1, perPage: 10 });

      expect(result.totalCount).toBe(5);
      expect(result.items).toHaveLength(5);
      // seed で最後に書いた "project.force_unpublish" が先頭
      expect(result.items[0].action).toBe("project.force_unpublish");
      // 時系列の単調減少を確認
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
          result.items[i].createdAt.getTime()
        );
      }
    });

    it("adminEmail が JOIN されて返る", async () => {
      await seedFixture();

      const result = await qs.findMany({}, { page: 1, perPage: 10 });

      const emails = new Set(result.items.map((r) => r.adminEmail));
      expect(emails).toEqual(new Set(["alice@example.com", "bob@example.com"]));
    });

    it("email フィルタ: 大文字混在でも小文字正規化でマッチする", async () => {
      await seedFixture();

      const result = await qs.findMany(
        { email: "Alice@Example.com" },
        { page: 1, perPage: 10 }
      );

      expect(result.totalCount).toBe(3);
      expect(result.items.every((r) => r.adminEmail === "alice@example.com")).toBe(true);
    });

    it("action フィルタで該当行のみ返る", async () => {
      await seedFixture();

      const result = await qs.findMany(
        { action: "leader_application.approve" },
        { page: 1, perPage: 10 }
      );

      expect(result.totalCount).toBe(2);
      expect(result.items.every((r) => r.action === "leader_application.approve")).toBe(true);
    });

    it("targetType フィルタで該当行のみ返る", async () => {
      await seedFixture();

      const result = await qs.findMany(
        { targetType: "Project" },
        { page: 1, perPage: 10 }
      );

      expect(result.totalCount).toBe(3);
      expect(result.items.every((r) => r.targetType === "Project")).toBe(true);
    });

    it("日付範囲フィルタ (from > 最新 createdAt) で 0 件", async () => {
      await seedFixture();

      const future = new Date(Date.now() + 1000 * 60 * 60 * 24); // +1 day
      const result = await qs.findMany({ from: future }, { page: 1, perPage: 10 });

      expect(result.totalCount).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it("ページネーション: 2 ページ目が残り分を返す", async () => {
      await seedFixture();

      const page1 = await qs.findMany({}, { page: 1, perPage: 3 });
      const page2 = await qs.findMany({}, { page: 2, perPage: 3 });

      expect(page1.totalCount).toBe(5);
      expect(page1.items).toHaveLength(3);
      expect(page2.totalCount).toBe(5);
      expect(page2.items).toHaveLength(2);

      // 重複なし
      const ids = new Set([...page1.items, ...page2.items].map((r) => r.id));
      expect(ids.size).toBe(5);
    });

    it("metadata が null / object / 未指定 で正しく復元される", async () => {
      await seedFixture();

      const all = await qs.findMany({}, { page: 1, perPage: 10 });

      const forceUnpublish = all.items.find((r) => r.action === "project.force_unpublish");
      expect(forceUnpublish?.metadata).toBeNull();

      const approveLa = all.items.find(
        (r) => r.action === "leader_application.approve" && r.targetId === "la-1"
      );
      expect(approveLa?.metadata).toEqual({ reviewerNote: "ok" });

      // metadata 未指定は DB NULL に落ちている想定
      const approveProject = all.items.find((r) => r.targetId === "p-2");
      expect(approveProject?.metadata).toBeNull();
    });
  });

  describe("listDistinctActions / listDistinctTargetTypes", () => {
    it("action / targetType の distinct リストをソート済みで返す", async () => {
      await seedFixture();

      const actions = await qs.listDistinctActions();
      const targetTypes = await qs.listDistinctTargetTypes();

      expect(actions).toEqual([
        "leader_application.approve",
        "project.approve",
        "project.force_unpublish",
        "project.reject",
      ]);
      expect(targetTypes).toEqual(["LeaderApplication", "Project"]);
    });

    it("空テーブルに対して 0 件配列を返す", async () => {
      const actions = await qs.listDistinctActions();
      const targetTypes = await qs.listDistinctTargetTypes();
      expect(actions).toEqual([]);
      expect(targetTypes).toEqual([]);
    });
  });
});
