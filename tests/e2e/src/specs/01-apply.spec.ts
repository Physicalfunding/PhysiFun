import { test, expect, TEST_LEADER, WEB_BASE_URL } from "../fixtures";

/**
 * 01. LP → リーダー応募フォーム送信
 *
 * - /apply を開く
 * - すべての必須項目を入力して「応募する」ボタンを押す
 * - 送信成功画面「応募を受け付けました」が表示される
 *
 * 事前状態: DB truncate 済み (setup)
 * 事後状態: LeaderApplication(PENDING) + LeaderApplicationOutbox(ACTIVATION_EMAIL) が作成される
 */
test("リーダー応募フォームから応募を送信し、成功画面が表示される", async ({ page }) => {
  await page.goto(`${WEB_BASE_URL}/apply`);

  // 基本情報
  await page.getByLabel("表示名").fill(TEST_LEADER.displayName);
  await page.getByLabel("メールアドレス").fill(TEST_LEADER.email);

  // プロジェクト情報
  await page.getByLabel("プロジェクトタイトル").fill(TEST_LEADER.projectTitle);
  await page.getByLabel("プロジェクト概要").fill(TEST_LEADER.projectSummary);
  await page.getByLabel("プロジェクトストーリー").fill(TEST_LEADER.projectStory);
  await page.getByLabel("プロジェクトカテゴリ").selectOption(TEST_LEADER.projectCategory);

  // 活動場所・予定
  await page.getByLabel("都道府県").selectOption(TEST_LEADER.prefectureCode);
  await page.getByLabel("市区町村").fill(TEST_LEADER.municipality);
  await page.getByLabel("活動予定").fill(TEST_LEADER.plannedActivities);

  // 利用規約同意
  await page.getByLabel(/利用規約/).check();

  await page.getByRole("button", { name: "応募する" }).click();

  // 成功画面
  await expect(page.getByRole("heading", { name: "応募を受け付けました" })).toBeVisible();
});
