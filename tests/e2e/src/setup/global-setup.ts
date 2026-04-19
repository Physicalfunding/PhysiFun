import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { truncateAll, seedAdminAccount } from "../helpers/db";
import { AUTH_DIR, ADMIN_STORAGE, ADMIN_BASE_URL } from "../fixtures";

/**
 * Setup project
 *
 * 1. .auth/ ディレクトリを用意
 * 2. DB を truncate + admin user を seed
 * 3. admin アプリにログインして storageState を保存
 */
setup("DB リセット + admin seed + admin storageState 保存", async ({ page }) => {
  // 1. .auth ディレクトリ作成
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // 2. DB truncate + admin seed
  await truncateAll();
  const admin = await seedAdminAccount();

  // 3. admin アプリにログインして storageState 保存
  await page.goto(`${ADMIN_BASE_URL}/login`);
  await page.getByLabel("メールアドレス").fill(admin.email);
  await page.getByLabel("パスワード").fill(admin.password);
  await page.getByRole("button", { name: "ログイン" }).click();

  // ログイン成功後、/ へ push される (admin/login/page.tsx)
  await page.waitForURL(new RegExp(`^${ADMIN_BASE_URL}(/|/\\?.*)?$`));
  expect(page.url()).not.toContain("/login");

  await page.context().storageState({ path: ADMIN_STORAGE });
  // 念のためファイルが作られたことを確認
  expect(fs.existsSync(ADMIN_STORAGE)).toBe(true);
  // lint (unused import suppression)
  void path;
});
