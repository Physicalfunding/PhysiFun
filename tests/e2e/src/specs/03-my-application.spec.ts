import { test, expect, TEST_LEADER, WEB_BASE_URL } from "../fixtures";
import { loginAsLeader } from "../helpers/auth";

/**
 * 03. リーダー応募の審査中の人が「マイプロジェクト」を開くと、応募状況（審査中）が出る（#374）
 *
 * - 応募者のアカウントでログインする（この時点ではまだリーダーではない）
 * - /my/projects（ヘッダーの「マイプロジェクト」のリンク先）を直接開くと、/my/application へ移る
 * - 「リーダー応募を審査中です」が出る
 *
 * 事前状態: 02-activate により Account(ACTIVE) が存在、LeaderApplication.status は PENDING のまま
 */
test("審査中の応募者は /my/projects から /my/application へ移り、審査中の表示を確認できる", async ({
  page,
}) => {
  await loginAsLeader(page, TEST_LEADER.email, TEST_LEADER.password);

  await page.goto(`${WEB_BASE_URL}/my/projects`);
  await page.waitForURL(/\/my\/application$/);

  const status = page.getByTestId("application-status");
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute("data-status", "PENDING");
  await expect(status.getByRole("heading", { name: "リーダー応募を審査中です" })).toBeVisible();
});
