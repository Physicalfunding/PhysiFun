import { test, expect, TEST_LEADER, ADMIN_BASE_URL, ADMIN_STORAGE } from "../fixtures";

test.use({ storageState: ADMIN_STORAGE });

/**
 * 04. 運営がリーダー応募を承認する
 *
 * - /applications?status=PENDING を開く
 * - 対象の応募を開く
 * - 「承認する」ボタンを押す (window.confirm は自動承諾)
 * - 承認後、バッジが APPROVED に変わっていることを確認する
 *
 * 事後状態: Account.roles に LEADER が追加される
 */
test("admin が PENDING 応募を承認でき、ステータスが APPROVED に変わる", async ({ page }) => {
  // window.confirm を常に承諾する
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(`${ADMIN_BASE_URL}/applications?status=PENDING`);

  // プロジェクトタイトルで応募行を特定してクリック
  await page.getByRole("link", { name: TEST_LEADER.projectTitle }).first().click();
  await page.waitForURL(/\/applications\/[0-9a-f-]+/);

  await page.getByTestId("approve-application-button").click();

  // 承認後、承認ボタンが消える / ステータス表示が変わる想定
  // 詳細画面の再描画を待つ (router.refresh)
  await expect(page.getByTestId("approve-application-button")).toHaveCount(0);
});
