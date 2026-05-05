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
  await page.getByLabel("お名前").fill(TEST_LEADER.displayName);
  await page.getByLabel("電話番号").fill(TEST_LEADER.phoneNumber);
  await page.getByLabel("メールアドレス").fill(TEST_LEADER.email);

  // プロジェクト詳細
  await page.getByLabel("プロジェクトタイトル").fill(TEST_LEADER.projectTitle);
  await page.getByLabel("プロジェクト概要").fill(TEST_LEADER.projectSummary);
  await page.getByLabel("プロジェクト説明（想い）").fill(TEST_LEADER.projectStory);
  await page.getByLabel("プロジェクトカテゴリ").selectOption(TEST_LEADER.projectCategory);

  // プロジェクトの進捗
  await page.getByLabel("準備中（企画・調整中）").check();

  // 募集内容: 時間（やる気）
  await page.getByLabel("時間（やる気）での支援を募集する").check();
  await page.getByLabel("活動内容").fill(TEST_LEADER.activityContent);
  await page.getByLabel("開催場所").fill(TEST_LEADER.eventLocation);
  await page.getByLabel("実施期間").fill(TEST_LEADER.eventPeriod);
  await page.getByLabel("募集人数").fill(String(TEST_LEADER.recruitCount));

  // リターン
  await page.getByLabel("体験できること").fill(TEST_LEADER.experienceOffered);
  await page.getByLabel("時間用リターン").fill(TEST_LEADER.timeReturn);

  // 活動場所
  await page.getByLabel("都道府県").selectOption(TEST_LEADER.prefectureCode);
  await page.getByLabel("市区町村").fill(TEST_LEADER.municipality);

  // 利用規約同意
  await page.getByLabel(/利用規約/).check();

  await page.getByRole("button", { name: "応募する" }).click();

  // 成功画面
  await expect(page.getByRole("heading", { name: "応募を受け付けました" })).toBeVisible();
});
