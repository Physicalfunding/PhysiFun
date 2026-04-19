import { test, expect, TEST_LEADER, WEB_BASE_URL } from "../fixtures";
import { getActivationToken } from "../helpers/outbox";

/**
 * 02. アクティベーション
 *
 * - Outbox から ACTIVATION_EMAIL のトークンを取得する
 * - /activate?token=XXX を開いてパスワードを設定する
 * - 成功メッセージが表示される
 *
 * 事前状態: 01-apply.spec により LeaderApplication(PENDING) / Outbox(ACTIVATION_EMAIL) が存在
 * 事後状態: Account(status=ACTIVE, roles=[SUPPORTER]) が作成される
 */
test("Outbox からトークンを取得し、アカウントを有効化できる", async ({ page }) => {
  const token = await getActivationToken(TEST_LEADER.email);

  await page.goto(`${WEB_BASE_URL}/activate?token=${encodeURIComponent(token)}`);

  await page.getByLabel("パスワード", { exact: true }).fill(TEST_LEADER.password);
  await page.getByLabel("パスワード確認").fill(TEST_LEADER.password);

  await page.getByRole("button", { name: "アカウントを有効化" }).click();

  await expect(
    page.getByText("アカウントが有効化されました。ログインしてください。")
  ).toBeVisible();
});
