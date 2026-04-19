import type { Page } from "@playwright/test";
import { WEB_BASE_URL } from "../fixtures";

/**
 * web アプリ (リーダー側, port 3000) にメール + パスワードでログインする。
 *
 * /login ページで NextAuth の credential プロバイダを叩き、
 * ログイン後の遷移先を待つ。
 */
export async function loginAsLeader(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto(`${WEB_BASE_URL}/login`);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();

  // ログイン後 /login から離れることだけを保証する
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
