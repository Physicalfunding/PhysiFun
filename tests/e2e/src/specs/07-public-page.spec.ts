import { test, expect, TEST_LEADER, WEB_BASE_URL } from "../fixtures";
import { prisma } from "../helpers/db";

/**
 * 07. 公開ページ閲覧 (未ログイン)
 *
 * - DB から公開済みプロジェクトの slug を取得
 * - /projects/{slug} を開き、タイトルが表示されることを確認
 *
 * 事前状態: 06-admin-publish により Project.status=PUBLISHED, slug 発行済み
 */
test("公開済みプロジェクトの公開ページを未ログインで閲覧できる", async ({ page }) => {
  const project = await prisma.project.findFirstOrThrow({
    where: { status: "PUBLISHED", title: TEST_LEADER.projectTitle },
    select: { slug: true, title: true },
  });
  expect(project.slug).not.toBeNull();

  await page.goto(`${WEB_BASE_URL}/projects/${project.slug}`);

  await expect(page.getByRole("heading", { name: project.title })).toBeVisible();
});
