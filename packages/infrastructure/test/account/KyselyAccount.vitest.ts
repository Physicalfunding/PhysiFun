import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { KyselyActivateAccountAdapter } from "../../src/account/KyselyActivateAccountAdapter";
import { KyselyAuthenticateAdapter } from "../../src/account/KyselyAuthenticateAdapter";
import { KyselyCleanupExpiredAccountsAdapter } from "../../src/account/KyselyCleanupExpiredAccountsAdapter";
import { db } from "../../src/database/kysely/client";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * Kysely 版 account 実装の integration test（#223）
 *
 * - シードは Prisma（既存ヘルパー）、検証対象は Kysely 実装。
 * - 実 PostgreSQL（Testcontainers）に対して、roles（ネイティブ enum 配列）の読み取り・
 *   status enum・トークンクリア・期限切れ一括削除（FK cascade 含む）が Prisma 版と同じ
 *   結果になることを確認する。
 */
describe("Kysely account 実装 integration", () => {
  const prisma = getTestPrisma();
  const activateAdapter = new KyselyActivateAccountAdapter();
  const authenticateAdapter = new KyselyAuthenticateAdapter();
  const cleanupAdapter = new KyselyCleanupExpiredAccountsAdapter();

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await db.destroy();
    await disconnectTestPrisma();
  });

  describe("ActivateAccount", () => {
    it("activationToken で検索し、activate で ACTIVE 化 + トークンをクリアする", async () => {
      const token = randomUUID().replace(/-/g, "");
      const exp = new Date(Date.now() + 60 * 60 * 1000);
      const account = await prisma.account.create({
        data: {
          email: "activate@example.com",
          displayName: "有効化対象",
          status: "PENDING_EMAIL_CONFIRMATION",
          roles: ["SUPPORTER"],
          activationToken: token,
          activationTokenExp: exp,
        },
      });

      const found = await activateAdapter.findByActivationToken(token);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(account.id);
      expect(found!.status).toBe("PENDING_EMAIL_CONFIRMATION");
      expect(found!.activationTokenExp?.getTime()).toBe(exp.getTime());

      await activateAdapter.activate({ accountId: account.id, passwordHash: "hashed-pw" });

      const updated = await db
        .selectFrom("accounts")
        .select(["status", "passwordHash", "activationToken", "activationTokenExp"])
        .where("id", "=", account.id)
        .executeTakeFirstOrThrow();
      expect(updated.status).toBe("ACTIVE");
      expect(updated.passwordHash).toBe("hashed-pw");
      expect(updated.activationToken).toBeNull();
      expect(updated.activationTokenExp).toBeNull();
    });

    it("存在しないトークンでは null", async () => {
      expect(await activateAdapter.findByActivationToken("does-not-exist")).toBeNull();
    });
  });

  describe("Authenticate（roles ネイティブ enum 配列の読み取り）", () => {
    it("ACTIVE + passwordHash ありのアカウントを roles 配列付きで返す", async () => {
      await prisma.account.create({
        data: {
          email: "leader@example.com",
          displayName: "ログイン太郎",
          status: "ACTIVE",
          roles: ["SUPPORTER", "LEADER"],
          passwordHash: "stored-hash",
        },
      });

      const account = await authenticateAdapter.findActiveAccountByEmail("leader@example.com");
      expect(account).not.toBeNull();
      expect(account!.email).toBe("leader@example.com");
      expect(account!.passwordHash).toBe("stored-hash");
      // ネイティブ enum 配列が JS 配列として読めること（parsePgEnumArray）
      expect(account!.roles).toEqual(["SUPPORTER", "LEADER"]);
    });

    it("PENDING / passwordHash=null / 未存在 はいずれも null", async () => {
      await prisma.account.create({
        data: {
          email: "pending@example.com",
          displayName: "未確認",
          status: "PENDING_EMAIL_CONFIRMATION",
          roles: ["SUPPORTER"],
          activationToken: randomUUID().replace(/-/g, ""),
        },
      });
      await prisma.account.create({
        data: {
          email: "nopw@example.com",
          displayName: "パスワード未設定",
          status: "ACTIVE",
          roles: ["SUPPORTER"],
          passwordHash: null,
        },
      });

      expect(await authenticateAdapter.findActiveAccountByEmail("pending@example.com")).toBeNull();
      expect(await authenticateAdapter.findActiveAccountByEmail("nopw@example.com")).toBeNull();
      expect(await authenticateAdapter.findActiveAccountByEmail("ghost@example.com")).toBeNull();
    });
  });

  describe("CleanupExpiredAccounts", () => {
    it("期限切れ PENDING を削除し、新しい PENDING / ACTIVE は残し、件数を返す", async () => {
      const cutoff = new Date("2026-01-01T00:00:00Z");

      await prisma.account.create({
        data: {
          email: "old-pending@example.com",
          displayName: "古い未確認",
          status: "PENDING_EMAIL_CONFIRMATION",
          roles: ["SUPPORTER"],
          createdAt: new Date("2025-12-01T00:00:00Z"),
        },
      });
      await prisma.account.create({
        data: {
          email: "new-pending@example.com",
          displayName: "新しい未確認",
          status: "PENDING_EMAIL_CONFIRMATION",
          roles: ["SUPPORTER"],
          createdAt: new Date("2026-02-01T00:00:00Z"),
        },
      });
      await prisma.account.create({
        data: {
          email: "old-active@example.com",
          displayName: "古い有効",
          status: "ACTIVE",
          roles: ["SUPPORTER"],
          passwordHash: "h",
          createdAt: new Date("2025-12-01T00:00:00Z"),
        },
      });

      const deleted = await cleanupAdapter.deleteExpiredPendingAccounts(cutoff);
      expect(deleted).toBe(1);

      const remaining = await db.selectFrom("accounts").select("email").orderBy("email").execute();
      expect(remaining.map((r) => r.email)).toEqual([
        "new-pending@example.com",
        "old-active@example.com",
      ]);
    });

    it("削除時に leader_applications を FK cascade で巻き込む", async () => {
      const account = await prisma.account.create({
        data: {
          email: "cascade@example.com",
          displayName: "カスケード対象",
          status: "PENDING_EMAIL_CONFIRMATION",
          roles: ["SUPPORTER"],
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      });
      await prisma.leaderApplication.create({
        data: {
          accountId: account.id,
          status: "PENDING",
          projectTitle: "タイトル",
          projectSummary: "概要",
          projectStory: "ストーリー",
          projectCategory: "EVENT",
          prefectureCode: "13",
          progress: "PLANNING",
          recruitmentTypes: ["TIME"],
          experienceOffered: "体験できること",
        },
      });

      const deleted = await cleanupAdapter.deleteExpiredPendingAccounts(
        new Date("2026-01-01T00:00:00Z")
      );
      expect(deleted).toBe(1);

      const appCount = await db
        .selectFrom("leader_applications")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .executeTakeFirstOrThrow();
      expect(Number(appCount.count)).toBe(0);
    });
  });
});
