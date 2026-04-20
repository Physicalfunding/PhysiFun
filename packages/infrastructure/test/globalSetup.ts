import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
    // コンテナ起動パスと同様、migrate deploy の失敗は明示的に検知してテスト全体を失敗させる。
    // コンテナを起動していないパスなので teardown は不要だが、原因を特定しやすいようにラップして再 throw する。
    try {
      runMigrateDeploy(process.env.DATABASE_URL);
    } catch (err) {
      throw new Error(
        `prisma migrate deploy が失敗しました (INFRA_TEST_DATABASE_URL 使用時): ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
    return;
  }

  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("physifun_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;

  try {
    runMigrateDeploy(url);
  } catch (err) {
    // migrate deploy が失敗した場合でも container がリークしないように停止する
    await container.stop();
    container = undefined;
    throw err;
  }
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
  // ESM 互換のため __dirname の代わりに import.meta.url 由来のパスを使う。
  const infraDirFromUrl = fileURLToPath(new URL("..", import.meta.url));
  const infraDir = path.resolve(infraDirFromUrl);
  execSync("bun prisma migrate deploy", {
    cwd: infraDir,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}
