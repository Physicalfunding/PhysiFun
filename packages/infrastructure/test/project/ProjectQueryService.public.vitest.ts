import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { KyselyProjectQueryService } from "../../src/project/KyselyProjectQueryService";
import { db, insertRow, insertRows, resetDatabase } from "../helpers/db";

/**
 * KyselyProjectQueryService の公開ページ向け `findPublishedRecruitmentsBySlug` の integration test（#219）
 *
 * - Testcontainers 起動済みの PostgreSQL にデータを入れ、公開中プロジェクトの募集と日程が読めることを確認する
 * - `status: PUBLISHED` の絞り込み・並び順・`date` が `"YYYY-MM-DD"` の文字列で返ることが目的
 */
describe("KyselyProjectQueryService (public) integration", () => {
  const service = new KyselyProjectQueryService();

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe("findPublishedRecruitmentsBySlug", () => {
    it("公開中プロジェクトの募集を作成順に、日程を募集ごとに日付順で返す（date は YYYY-MM-DD の文字列）", async () => {
      const { projectId, slug } = await seedProject("PUBLISHED");
      const later = await insertRow("support_recruitments", {
        projectId,
        type: "ACTIVITY",
        title: "収穫の手伝い",
        description: "秋の収穫",
        createdAt: new Date("2026-10-02T00:00:00Z"),
      });
      const earlier = await insertRow("support_recruitments", {
        projectId,
        type: "ACTIVITY",
        title: "畑の草刈り",
        description: "一緒に草刈り",
        createdAt: new Date("2026-10-01T00:00:00Z"),
      });
      await insertRows("recruitment_schedules", [
        {
          supportRecruitmentId: earlier.id,
          date: "2099-01-12",
          startTime: "13:00",
          endTime: "17:00",
          capacityPerHour: 2,
          approvalMode: "MANUAL",
        },
        {
          supportRecruitmentId: earlier.id,
          date: "2099-01-10",
          startTime: "10:00",
          endTime: "15:00",
          capacityPerHour: 5,
          approvalMode: "AUTO",
        },
        // 別の募集の日程（募集ごとに振り分けられることの確認用。日付は earlier の 2 件の間）
        {
          supportRecruitmentId: later.id,
          date: "2099-01-11",
          startTime: "09:00",
          endTime: "12:00",
          capacityPerHour: 1,
          approvalMode: "AUTO",
        },
      ]);

      const result = await service.findPublishedRecruitmentsBySlug(slug);

      expect(result.map((r) => r.title)).toEqual(["畑の草刈り", "収穫の手伝い"]);
      expect(result[0]).toMatchObject({
        id: earlier.id,
        type: "ACTIVITY",
        description: "一緒に草刈り",
      });
      expect(result[0].schedules).toEqual([
        expect.objectContaining({
          date: "2099-01-10",
          startTime: "10:00",
          endTime: "15:00",
          capacityPerHour: 5,
          approvalMode: "AUTO",
        }),
        expect.objectContaining({
          date: "2099-01-12",
          startTime: "13:00",
          endTime: "17:00",
          capacityPerHour: 2,
          approvalMode: "MANUAL",
        }),
      ]);
      expect(result[1].id).toBe(later.id);
      expect(result[1].schedules.map((s) => s.date)).toEqual(["2099-01-11"]);
    });

    it("他のプロジェクトの募集は混ざらない", async () => {
      const { projectId, slug } = await seedProject("PUBLISHED");
      const other = await seedProject("PUBLISHED", "other@example.com");
      await insertRow("support_recruitments", {
        projectId,
        type: "ACTIVITY",
        title: "自分の募集",
        description: "説明",
      });
      await insertRow("support_recruitments", {
        projectId: other.projectId,
        type: "ACTIVITY",
        title: "他人の募集",
        description: "説明",
      });

      const result = await service.findPublishedRecruitmentsBySlug(slug);

      expect(result.map((r) => r.title)).toEqual(["自分の募集"]);
    });

    it.each(["DRAFT", "PENDING_REVIEW"] as const)(
      "%s のプロジェクトの募集は返さない（公開ページに出ない）",
      async (status) => {
        const { projectId, slug } = await seedProject(status);
        await insertRow("support_recruitments", {
          projectId,
          type: "ACTIVITY",
          title: "非公開の募集",
          description: "説明",
        });

        expect(await service.findPublishedRecruitmentsBySlug(slug)).toEqual([]);
      }
    );

    it("存在しない slug は空配列", async () => {
      expect(await service.findPublishedRecruitmentsBySlug("no-such-slug")).toEqual([]);
    });
  });
});

/** リーダーと、slug 付きのプロジェクトを DB に入れる（slug は id と同じ値。公開承認のフローに合わせる） */
async function seedProject(
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED",
  email = "leader@example.com"
): Promise<{ projectId: string; slug: string }> {
  const leader = await insertRow("accounts", {
    email,
    displayName: "リーダー",
    status: "ACTIVE",
    roles: ["LEADER"],
    passwordHash: "dummy",
  });
  const slug = randomUUID();
  const project = await insertRow("projects", {
    id: slug,
    slug,
    ownerAccountId: leader.id,
    title: "畑のプロジェクト",
    status,
    phase: "VISION",
    publishedAt: status === "PUBLISHED" ? new Date() : null,
  });
  return { projectId: project.id, slug };
}
