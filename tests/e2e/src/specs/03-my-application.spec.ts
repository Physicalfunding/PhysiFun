import { test, expect, TEST_LEADER, WEB_BASE_URL } from "../fixtures";
import { loginAsLeader } from "../helpers/auth";

/**
 * 03. /my/application で PENDING ステータスが表示される
 *
 * - リーダーアカウントでログインする
 * - /my/application を開く
 * - ApplicationStatus コンポーネントで「審査中」が表示されていることを確認する
 *
 * 事前状態: 02-activate により Account(ACTIVE) が存在、LeaderApplication.status は PENDING のまま
 */
// TODO(#84-followup): `/api/my/application` が現状スタブ実装（常に null 返却）のため原理的に通らない。
// apps/web/src/app/api/my/application/route.ts に PrismaFindLeaderApplicationAdapter を実装後、skip を外す。
test.skip("有効化済みリーダーが /my/application で PENDING ステータスを確認できる", async ({
  page,
}) => {
  await loginAsLeader(page, TEST_LEADER.email, TEST_LEADER.password);

  await page.goto(`${WEB_BASE_URL}/my/application`);

  const status = page.getByTestId("application-status");
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute("data-status", "PENDING");
  await expect(status.getByRole("heading", { name: "審査中" })).toBeVisible();
});
