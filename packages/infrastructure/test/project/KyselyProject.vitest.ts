import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ProjectLimitExceededError } from "@physifun/application";
import { KyselyProjectQueryService } from "../../src/project/KyselyProjectQueryService";
import { KyselyProjectCommandAdapter } from "../../src/project/KyselyProjectCommandAdapter";
import { reconstructProject } from "../../src/project/reconstructProject";
import { db } from "../../src/database/kysely/client";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * Kysely 版 Project 実装の integration test（PoC 検証）
 *
 * - シードは Prisma（既存ヘルパー）で行い、検証対象は Kysely 実装。
 * - 実 PostgreSQL（Testcontainers）に対して、カラム名・jsonb 直列化・JOIN・
 *   トランザクション / TOCTOU が Prisma 版と同じ結果になることを確認する。
 */
describe("Kysely Project 実装 integration", () => {
  const prisma = getTestPrisma();
  const queryService = new KyselyProjectQueryService();
  const commandAdapter = new KyselyProjectCommandAdapter();

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await db.destroy();
    await disconnectTestPrisma();
  });

  describe("findManyForAdmin", () => {
    it("PENDING_REVIEW を publishRequestedAt DESC で返し owner を join する", async () => {
      const leader = await prisma.account.create({
        data: {
          email: "leader@example.com",
          displayName: "リーダー太郎",
          status: "ACTIVE",
          roles: ["LEADER"],
          passwordHash: "dummy",
        },
      });

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
      await prisma.project.create({
        data: {
          ownerAccountId: leader.id,
          title: "DRAFT のプロジェクト",
          status: "DRAFT",
          phase: "VISION",
        },
      });

      const result = await queryService.findManyForAdmin({
        status: "PENDING_REVIEW",
        page: 1,
        perPage: 20,
      });

      expect(result.totalCount).toBe(2);
      expect(result.items.map((i) => i.title)).toEqual(["新しい申請", "古い申請"]);
      expect(result.items[0].ownerDisplayName).toBe("リーダー太郎");
      expect(result.items[0].ownerEmail).toBe("leader@example.com");
    });
  });

  describe("findDetailForAdmin", () => {
    it("審査履歴を admin_accounts と join して reviewedAt DESC 最大 5 件返す", async () => {
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
        data: { email: "admin@example.com", status: "ACTIVE" },
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

      const detail = await queryService.findDetailForAdmin(project.id);
      expect(detail).not.toBeNull();
      expect(detail!.owner.displayName).toBe("レビュー対象リーダー");
      expect(detail!.owner.bio).toBe("bio テキスト");
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

    it("存在しない projectId では null", async () => {
      const result = await queryService.findDetailForAdmin("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  describe("countByStatus", () => {
    it("status ごとの件数を返す", async () => {
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

      expect(await queryService.countByStatus("DRAFT")).toBe(3);
      expect(await queryService.countByStatus("PENDING_REVIEW")).toBe(1);
      expect(await queryService.countByStatus("PUBLISHED")).toBe(0);
    });
  });

  describe("findProjectDetailForOwner（jsonb 読み取り + owner-check）", () => {
    it("owner 本人には snsLinks(jsonb) を含めて返し、別 owner には null", async () => {
      const owner = await prisma.account.create({
        data: {
          email: "owner@example.com",
          displayName: "オーナー",
          status: "ACTIVE",
          roles: ["LEADER"],
          passwordHash: "dummy",
        },
      });
      const project = await prisma.project.create({
        data: {
          ownerAccountId: owner.id,
          title: "snsLinks 確認",
          status: "DRAFT",
          phase: "VISION",
          snsLinks: { x: "https://x.com/foo", instagram: null, facebook: null, website: null },
        },
      });

      const detail = await queryService.findProjectDetailForOwner(project.id, owner.id);
      expect(detail).not.toBeNull();
      expect(detail!.title).toBe("snsLinks 確認");
      expect(detail!.snsLinks.x).toBe("https://x.com/foo");

      // 別アカウントからは取得不可
      const other = await queryService.findProjectDetailForOwner(project.id, randomUUID());
      expect(other).toBeNull();
    });
  });

  describe("countAndSaveProject（INSERT + jsonb 書き込み + TOCTOU）", () => {
    it("Project を保存でき、findProjectById で復元できる", async () => {
      const owner = await prisma.account.create({
        data: {
          email: "writer@example.com",
          displayName: "ライター",
          status: "ACTIVE",
          roles: ["LEADER"],
          passwordHash: "dummy",
        },
      });

      const project = reconstructProject({
        id: randomUUID(),
        ownerAccountId: owner.id,
        title: "新規ドラフト",
        coverImageUrl: null,
        category: null,
        prefectureCode: null,
        municipality: null,
        phase: "VISION",
        status: "DRAFT",
        summary: null,
        story: null,
        leaderIntro: null,
        snsLinks: {},
        activityPlan: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await commandAdapter.countAndSaveProject({ project, accountId: owner.id, maxCount: 3 });

      const loaded = await commandAdapter.findProjectById(project.id.toString());
      expect(loaded).not.toBeNull();
      expect(loaded!.title).toBe("新規ドラフト");

      // DB 行が 1 件だけ存在することを Kysely 直クエリで確認
      const count = await db
        .selectFrom("projects")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("ownerAccountId", "=", owner.id)
        .executeTakeFirstOrThrow();
      expect(Number(count.count)).toBe(1);
    });

    it("maxCount 到達時は同一 tx 内の count チェックで ProjectLimitExceededError", async () => {
      const owner = await prisma.account.create({
        data: {
          email: "limit@example.com",
          displayName: "上限テスト",
          status: "ACTIVE",
          roles: ["LEADER"],
          passwordHash: "dummy",
        },
      });
      await prisma.project.create({
        data: { ownerAccountId: owner.id, title: "既存1", status: "DRAFT", phase: "VISION" },
      });

      const project = reconstructProject({
        id: randomUUID(),
        ownerAccountId: owner.id,
        title: "2件目（上限超過）",
        coverImageUrl: null,
        category: null,
        prefectureCode: null,
        municipality: null,
        phase: "VISION",
        status: "DRAFT",
        summary: null,
        story: null,
        leaderIntro: null,
        snsLinks: {},
        activityPlan: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        commandAdapter.countAndSaveProject({ project, accountId: owner.id, maxCount: 1 })
      ).rejects.toBeInstanceOf(ProjectLimitExceededError);

      // ロールバックされ件数は増えていない
      const count = await db
        .selectFrom("projects")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("ownerAccountId", "=", owner.id)
        .executeTakeFirstOrThrow();
      expect(Number(count.count)).toBe(1);
    });
  });
});
