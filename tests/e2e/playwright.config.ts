import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

/**
 * Phase 1 メインフロー E2E 設定
 *
 * 設計メモ:
 * - web (apps/web, port 3000) と admin (apps/admin, port 3001) を同時に起動する
 * - 7 本の spec は直列実行で DB 状態を引き継ぐ (fullyParallel=false, workers=1)
 * - CI では `next build` + `next start` を使う (next dev は起動が不安定なため)
 * - Supabase Storage は使わないため Supabase 関連環境変数はダミー値でも動作する前提
 */

const CI = !!process.env.CI;
const REPO_ROOT = path.resolve(__dirname, "../..");

// E2E 専用ポート。ローカル開発で 3000/3001 が他用途で使われていても衝突しないよう
// 30000 番台に振っている。実環境 (apps/web の dev/start) は 3000 を継続使用。
const WEB_PORT = 31000;
const ADMIN_PORT = 31001;
const WEB_BASE_URL = `http://localhost:${WEB_PORT}`;
const ADMIN_BASE_URL = `http://localhost:${ADMIN_PORT}`;

// E2E 専用の固定シークレット。本番で使わないこと。
const E2E_NEXTAUTH_SECRET = "e2e-test-secret-do-not-use-in-production";
// Magic Link / cron 用 secret も本番で使わないこと。NEXTAUTH_SECRET と別値であることが
// 起動時に検証される (#146)。
export const E2E_ADMIN_MAGIC_LINK_HMAC_SECRET =
  "e2e-admin-magic-link-hmac-secret-do-not-use-in-production";
export const E2E_CRON_SECRET = "e2e-cron-secret-do-not-use-in-production";

const webServerEnv = {
  PORT: String(WEB_PORT),
  NEXTAUTH_SECRET: E2E_NEXTAUTH_SECRET,
  NEXTAUTH_URL: WEB_BASE_URL,
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  // Supabase 関連はダミー値でも Phase 1 E2E は通る (Storage 不使用)
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "dummy-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dummy-service-role-key",
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET ?? "project-images",
};

const adminServerEnv = {
  ...webServerEnv,
  PORT: String(ADMIN_PORT),
  NEXTAUTH_URL: ADMIN_BASE_URL,
  // #146: HMAC 検証は起動時に fail-closed で検証される。NEXTAUTH_SECRET と別値必須。
  ADMIN_MAGIC_LINK_HMAC_SECRET: E2E_ADMIN_MAGIC_LINK_HMAC_SECRET,
  // #158 / #159: cron GC エンドポイントの Bearer token
  CRON_SECRET: E2E_CRON_SECRET,
  // RESEND_API_KEY 未設定なら NoopMailSender にフォールバックするため敢えて設定しない
  // (E2E ではメール送信を経由せず DB の AdminVerificationToken を直接読む)。
};

export default defineConfig({
  testDir: "./src",
  // DB 状態を引き継ぐため直列実行
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: WEB_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /setup\/global-setup\.ts/,
    },
    {
      name: "main-flow",
      testMatch: /specs\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // E2E では `next dev/start -p <PORT>` を直接呼ぶ。
      // - web の package.json の `dev` は PORT env を尊重するが、
      //   admin の `dev` は `next dev --port 3001` でハードコードのため上書き不可。
      //   両者で挙動を揃えるため CLI で `-p ${PORT}` を渡し、cwd を各 app に切り替える。
      command: CI ? `bun next start -p ${WEB_PORT}` : `bun next dev -p ${WEB_PORT}`,
      url: WEB_BASE_URL,
      cwd: path.resolve(REPO_ROOT, "apps/web"),
      reuseExistingServer: !CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: webServerEnv,
    },
    {
      command: CI ? `bun next start -p ${ADMIN_PORT}` : `bun next dev -p ${ADMIN_PORT}`,
      url: ADMIN_BASE_URL,
      cwd: path.resolve(REPO_ROOT, "apps/admin"),
      reuseExistingServer: !CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: adminServerEnv,
    },
  ],
});
