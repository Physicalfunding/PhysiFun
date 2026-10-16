import { test, expect, TEST_LEADER, WEB_BASE_URL } from "../fixtures";
import { db } from "../helpers/db";

/**
 * 07. 公開ページ閲覧 (未ログイン)
 *
 * - DB から公開済みプロジェクトの slug を取得
 * - /projects/{slug} を開き、タイトルが表示されることを確認
 *
 * 事前状態: 06-admin-publish により Project.status=PUBLISHED, slug 発行済み
 */
// TODO(#84-followup): 06-admin-publish (さらにその前提の 05-project-create) の skip を外した後に有効化する。
// PUBLISHED 済みの Project/slug が事前状態として必要なため、前段が通らないと本テストも成立しない。
test.skip("公開済みプロジェクトの公開ページを未ログインで閲覧できる", async ({ page }) => {
  const project = await db
    .selectFrom("projects")
    .select(["slug", "title"])
    .where("status", "=", "PUBLISHED")
    .where("title", "=", TEST_LEADER.projectTitle)
    .executeTakeFirstOrThrow();
  expect(project.slug).not.toBeNull();

  await page.goto(`${WEB_BASE_URL}/projects/${project.slug}`);

  await expect(page.getByRole("heading", { name: project.title })).toBeVisible();
});
