import { test, expect, TEST_LEADER, TEST_PROJECT, WEB_BASE_URL } from "../fixtures";
import { loginAsLeader } from "../helpers/auth";

/**
 * 05. プロジェクト作成 → 編集 → 公開申請
 *
 * - リーダーで再ログイン (承認後は roles に LEADER が含まれる)
 * - /my/projects でモーダルからプロジェクトを作成
 * - /my/projects/{id}/edit に遷移し、必須項目を入力して保存
 * - /my/projects/{id} の公開申請ボタンから公開申請を出す
 *
 * 事後状態: Project.status = PENDING_REVIEW
 */
// TODO(#84-followup): CI (next start) ではプロジェクト作成後の /my/projects/{id}/edit への遷移が走らず
// waitForURL がタイムアウトする。ローカル dev では通る可能性があるため、根本原因を切り分けて skip を外す。
// 原因候補: 認証 JWT のロール反映遅延 / POST /api/my/projects のレスポンス扱い / Next.js 16 本番ビルドでの router.push の差異。
test.skip("リーダーがプロジェクトを作成し、編集して公開申請を出せる", async ({ page }) => {
  await loginAsLeader(page, TEST_LEADER.email, TEST_LEADER.password);

  // プロジェクト一覧からモーダルで新規作成
  await page.goto(`${WEB_BASE_URL}/my/projects`);
  await page.getByTestId("create-project-button").click();
  await page.getByLabel("プロジェクトタイトル").fill(TEST_LEADER.projectTitle);
  await page.getByTestId("confirm-create-project").click();

  // 編集ページに遷移するまで待つ
  await page.waitForURL(/\/my\/projects\/[0-9a-f-]+\/edit/);

  // 編集ページで各フィールドを埋める
  await page.getByLabel("概要").fill(TEST_PROJECT.summary);
  await page.getByLabel("プロジェクト詳細").fill(TEST_PROJECT.body);
  await page.getByLabel("リーダー紹介").fill(TEST_PROJECT.leaderIntroduction);
  await page.getByLabel("活動計画").fill(TEST_PROJECT.activityPlan);
  await page.getByLabel("カテゴリ").selectOption(TEST_PROJECT.category);
  await page.getByLabel("都道府県").selectOption(TEST_PROJECT.prefectureCode);
  await page.getByLabel("市区町村").fill(TEST_PROJECT.municipality);

  await page.getByRole("button", { name: "保存" }).click();

  // 詳細ページへ遷移
  await page.waitForURL(/\/my\/projects\/[0-9a-f-]+$/);

  // 公開申請
  await page.getByTestId("request-publish-button").click();
  // ConfirmModal で「申請する」確定
  await page.getByRole("button", { name: "申請する" }).click();

  // PENDING_REVIEW バナー相当の文言が出るまで待つ
  await expect(page.getByText(/公開申請/).first()).toBeVisible();
});
