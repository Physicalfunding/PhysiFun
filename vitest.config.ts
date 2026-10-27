import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * ユニットテストの Vitest 設定（#253）。ルートで `bun run test` を実行すると全パッケージをまとめて回す。
 *
 * - 各パッケージを project として登録し、`src/**\/*.test.ts(x)` を対象にする（環境はすべて node）
 * - apps は `@/` を各アプリの `src/` に解決する（Next.js の tsconfig paths と同じ）
 * - infrastructure の統合テスト（`test/**\/*.vitest.ts`、Testcontainers）は対象外。
 *   `packages/infrastructure/vitest.config.ts` を使い、`bun run test:infra` で別に実行する
 * - E2E（Playwright, `tests/e2e`）も対象外
 */
const appSrc = (app: string) => fileURLToPath(new URL(`./apps/${app}/src`, import.meta.url));

export default defineConfig({
  test: {
    projects: [
      { test: { name: "domain", root: "packages/domain", include: ["src/**/*.test.ts"] } },
      {
        test: { name: "application", root: "packages/application", include: ["src/**/*.test.ts"] },
      },
      {
        test: {
          name: "infrastructure",
          root: "packages/infrastructure",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "server-shared",
          root: "packages/server-shared",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "ui-shared",
          root: "packages/ui-shared",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        resolve: { alias: { "@": appSrc("web") } },
        test: { name: "web", root: "apps/web", include: ["src/**/*.test.{ts,tsx}"] },
      },
      {
        resolve: { alias: { "@": appSrc("admin") } },
        test: { name: "admin", root: "apps/admin", include: ["src/**/*.test.ts"] },
      },
    ],
  },
});
