import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import { truncateAll, seedAdminAccount, seedAdminSession } from "../helpers/db";
import { AUTH_DIR, ADMIN_STORAGE, ADMIN_BASE_URL } from "../fixtures";

/**
 * Setup project (#145)
 *
 * 1. .auth/ ディレクトリを用意
 * 2. DB を truncate + AdminAccount seed
 * 3. AdminSession 行を DB に直接作成し、sessionToken Cookie をブラウザに注入して
 *    Playwright の storageState に保存する。マジックリンクのメール受信・クリック
 *    フローを省略するための割り切り。
 */
setup("DB リセット + admin seed + admin storageState 保存", async ({ page }) => {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  await truncateAll();
  const admin = await seedAdminAccount();
  const { sessionToken, expires } = await seedAdminSession({ adminAccountId: admin.id });

  // ADMIN_BASE_URL は http://localhost:3001。NextAuth のデフォルト Cookie 名を使う。
  const adminUrl = new URL(ADMIN_BASE_URL);
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      domain: adminUrl.hostname,
      path: "/",
      httpOnly: true,
      secure: false, // 開発環境 (http) のため
      sameSite: "Lax",
      expires: Math.floor(expires.getTime() / 1000),
    },
  ]);

  // Cookie を実際にサーバーに送って認証が効いていることを確認。
  // middleware は Cookie 存在のみチェックし、実際の AdminSession 検証は
  // Server Component / Route Handler で行う。トップページは認可済みなら
  // /login にリダイレクトしない。
  await page.goto(`${ADMIN_BASE_URL}/`);
  await page.waitForLoadState("domcontentloaded");
  expect(page.url()).not.toContain("/login");

  await page.context().storageState({ path: ADMIN_STORAGE });
  expect(fs.existsSync(ADMIN_STORAGE)).toBe(true);
});
