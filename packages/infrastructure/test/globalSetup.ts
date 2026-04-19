import { execSync } from "node:child_process";
import path from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Vitest globalSetup (Issue #122)
 *
 * - Testcontainers で PostgreSQL を起動する (local / CI どちらも Docker が必要)
 * - prisma migrate deploy を実行してスキーマを適用する
 * - DATABASE_URL を env に注入することで、 packages/infrastructure/src/database/client.ts の
 *   Prisma Client シングルトンが参照できるようにする
 * - teardown で container を停止する
 *
 * 注意: このモジュールは vitest の globalSetup として読み込まれるため、各 worker とは別プロセスで動く。
 *       コンテナの接続文字列は env で共有する。
 */
let container: StartedPostgreSqlContainer | undefined;

export async function setup(): Promise<void> {
  // 既に Docker 外で DB が用意されている場合 (例: docker-compose) はそれを使う
  if (process.env.INFRA_TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.INFRA_TEST_DATABASE_URL;
    runMigrateDeploy(process.env.DATABASE_URL);
    return;
  }

  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("physifun_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;

  runMigrateDeploy(url);
}

export async function teardown(): Promise<void> {
  if (container) {
    await container.stop();
    container = undefined;
  }
}

function runMigrateDeploy(databaseUrl: string): void {
  // prisma CLI は packages/infrastructure/prisma.config.ts を読みに行くが、
  // そちらは apps/web/.env.local を読み込む実装になっている。
  // integration test では container の URL を優先させたいので env を明示して渡す。
  const infraDir = path.resolve(__dirname, "..");
  execSync("bun prisma migrate deploy", {
    cwd: infraDir,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}
