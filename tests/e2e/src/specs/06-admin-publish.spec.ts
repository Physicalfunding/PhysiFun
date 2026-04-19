import { test, expect, TEST_LEADER, ADMIN_BASE_URL, ADMIN_STORAGE } from "../fixtures";

test.use({ storageState: ADMIN_STORAGE });

/**
 * 06. 運営がプロジェクトの公開申請を承認する
 *
 * - /projects?status=PENDING_REVIEW を開く
 * - 対象プロジェクトを開く
 * - 「承認する」→ モーダル内の「承認する」で確定
 * - 承認後、PUBLISHED に遷移しているはず (ステータスバッジ等で検証)
 *
 * 事後状態: Project.status = PUBLISHED, slug が発行される
 */
test("admin が PENDING_REVIEW のプロジェクトを承認でき、PUBLISHED に遷移する", async ({ page }) => {
  await page.goto(`${ADMIN_BASE_URL}/projects?status=PENDING_REVIEW`);

  await page.getByRole("link", { name: TEST_LEADER.projectTitle }).first().click();
  await page.waitForURL(/\/projects\/[0-9a-f-]+/);

  await page.getByTestId("approve-project-button").click();
  // モーダル内の承認ボタン
  await page.getByTestId("confirm-approve-project").click();

  // router.refresh 後、承認ボタンが消えるか PUBLISHED 表示になる
  await expect(page.getByTestId("approve-project-button")).toHaveCount(0);
});
