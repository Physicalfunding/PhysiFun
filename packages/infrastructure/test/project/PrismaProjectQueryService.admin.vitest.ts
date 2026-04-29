import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaProjectQueryService } from "../../src/project/PrismaProjectQueryService";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * PrismaProjectQueryService の ADMIN 向けメソッドの integration test (Issue #122)
 *
 * - Testcontainers 起動済みの PostgreSQL に対して実データを投入し、クエリ結果を検証する
 * - Prisma の挙動 (関連 include / orderBy / pagination) を実 DB で確認することが目的
 */
describe("PrismaProjectQueryService (admin) integration", () => {
  const prisma = getTestPrisma();
  const service = new PrismaProjectQueryService();

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  describe("findManyForAdmin", () => {
    it("PENDING_REVIEW のプロジェクトを publishRequestedAt DESC で返す", async () => {
      const leader = await prisma.account.create({
        data: {
          email: "leader@example.com",
          displayName: "リーダー太郎",
          status: "ACTIVE",
          roles: ["LEADER"],
          passwordHash: "dummy",
        },
      });

      // publishRequestedAt が異なる 2 件を作成
      await prisma.project.create({
        data: {
          ownerAccountId: leader.id,
          title: "古い申請",
          status: "PENDING_REVIEW",
          phase: "VISION",
          publishRequestedAt: new Date("2026-01-01T00:00:00Z"),
        },
      });
      await prisma.project.create({
        data: {
          ownerAccountId: leader.id,
          title: "新しい申請",
          status: "PENDING_REVIEW",
          phase: "VISION",
          publishRequestedAt: new Date("2026-02-01T00:00:00Z"),
        },
      });

      // DRAFT は結果に含まれないことを確認するため 1 件作成
      await prisma.project.create({
        data: {
          ownerAccountId: leader.id,
          title: "DRAFT のプロジェクト",
          status: "DRAFT",
          phase: "VISION",
        },
      });

      const result = await service.findManyForAdmin({
        status: "PENDING_REVIEW",
        page: 1,
        perPage: 20,
      });

      expect(result.totalCount).toBe(2);
      expect(result.items.map((item) => item.title)).toEqual(["新しい申請", "古い申請"]);
      expect(result.items[0].ownerDisplayName).toBe("リーダー太郎");
      expect(result.items[0].ownerEmail).toBe("leader@example.com");
    });

    it("pagination (perPage=1) で 2 ページに分割される", async () => {
      const leader = await prisma.account.create({
        data: {
          email: "leader2@example.com",
          displayName: "リーダー花子",
          status: "ACTIVE",
          roles: ["LEADER"],
          passwordHash: "dummy",
        },
      });
      for (let i = 0; i < 2; i++) {
        await prisma.project.create({
          data: {
            ownerAccountId: leader.id,
            title: `申請 ${i}`,
            status: "PENDING_REVIEW",
            phase: "VISION",
            publishRequestedAt: new Date(`2026-0${i + 1}-01T00:00:00Z`),
          },
        });
      }

      const page1 = await service.findManyForAdmin({
        status: "PENDING_REVIEW",
        page: 1,
        perPage: 1,
      });
      expect(page1.totalCount).toBe(2);
      expect(page1.items).toHaveLength(1);
      expect(page1.items[0].title).toBe("申請 1");

      const page2 = await service.findManyForAdmin({
        status: "PENDING_REVIEW",
        page: 2,
        perPage: 1,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0].title).toBe("申請 0");
    });
  });

  describe("findDetailForAdmin", () => {
    it("審査履歴は reviewedAt DESC で最大 5 件まで返る", async () => {
      const leader = await prisma.account.create({
        data: {
          email: "leader3@example.com",
          displayName: "レビュー対象リーダー",
          status: "ACTIVE",
          roles: ["LEADER"],
          passwordHash: "dummy",
          bio: "bio テキスト",
        },
      });
      const reviewer = await prisma.adminAccount.create({
        data: {
          email: "admin@example.com",
          status: "ACTIVE",
        },
      });
      const project = await prisma.project.create({
        data: {
          ownerAccountId: leader.id,
          title: "詳細対象",
          status: "PENDING_REVIEW",
          phase: "VISION",
          publishRequestedAt: new Date("2026-02-01T00:00:00Z"),
        },
      });

      // 履歴を 6 件作成
      for (let i = 0; i < 6; i++) {
        await prisma.projectReviewFeedback.create({
          data: {
            projectId: project.id,
            reviewerId: reviewer.id,
            action: "REJECTED",
            note: `フィードバック ${i}`,
            reviewedAt: new Date(`2026-02-0${i + 1}T00:00:00Z`),
          },
        });
      }

      const detail = await service.findDetailForAdmin(project.id);
      expect(detail).not.toBeNull();
      expect(detail!.owner.displayName).toBe("レビュー対象リーダー");
      expect(detail!.owner.bio).toBe("bio テキスト");
      // 最新 5 件が reviewedAt DESC で返る
      expect(detail!.reviewFeedbacks).toHaveLength(5);
      expect(detail!.reviewFeedbacks.map((f) => f.note)).toEqual([
        "フィードバック 5",
        "フィードバック 4",
        "フィードバック 3",
        "フィードバック 2",
        "フィードバック 1",
      ]);
      expect(detail!.reviewFeedbacks[0].reviewerEmail).toBe("admin@example.com");
    });

    it("存在しない projectId では null を返す", async () => {
      const result = await service.findDetailForAdmin("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  describe("countByStatus", () => {
    it("指定した status の件数を返す", async () => {
      const leader = await prisma.account.create({
        data: {
          email: "leader4@example.com",
          displayName: "カウント対象",
          status: "ACTIVE",
          roles: ["LEADER"],
          passwordHash: "dummy",
        },
      });
      for (let i = 0; i < 3; i++) {
        await prisma.project.create({
          data: {
            ownerAccountId: leader.id,
            title: `DRAFT ${i}`,
            status: "DRAFT",
            phase: "VISION",
          },
        });
      }
      await prisma.project.create({
        data: {
          ownerAccountId: leader.id,
          title: "PENDING",
          status: "PENDING_REVIEW",
          phase: "VISION",
          publishRequestedAt: new Date(),
        },
      });

      expect(await service.countByStatus("DRAFT")).toBe(3);
      expect(await service.countByStatus("PENDING_REVIEW")).toBe(1);
      expect(await service.countByStatus("PUBLISHED")).toBe(0);
    });
  });
});
