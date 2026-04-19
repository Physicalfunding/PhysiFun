import { defineConfig } from "vitest/config";

/**
 * @physifun/infrastructure 用 vitest 設定 (Issue #122)
 *
 * 方針:
 * - 実 PostgreSQL に依存する integration test を扱う。ローカル / CI で Docker が必要。
 * - `bun test` との衝突を避けるため、テストファイルは `test/**` 配下の `*.vitest.ts` のみを対象にする
 *   (bun test は `*.test.ts` / `*.spec.ts` 系のみを拾うため、拡張子で自然に棲み分けできる)。
 * - globalSetup で Testcontainers 上に PostgreSQL を起動し、`prisma migrate deploy` を実行したうえで
 *   各テストに DATABASE_URL を注入する。
 */
export default defineConfig({
  test: {
    include: ["test/**/*.vitest.ts"],
    globalSetup: ["./test/globalSetup.ts"],
    // Testcontainers の起動 + prisma migrate deploy は数十秒かかるため長めに設定
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // 1 つの PostgreSQL コンテナをテスト間で共有する。並列実行時の DB 競合を避けるため
    // fileParallelism を無効にしてテストファイルを直列実行する。
    // vitest v4 では `fileParallelism: false` を設定すると `maxWorkers` が 1 に強制されるため、
    // ワーカーは 1 つのフォークに固定され、globalSetup で `process.env` に注入した
    // `DATABASE_URL` がフォーク起動時に継承される (Node の child_process.fork は親の env を継承する)。
    // v3 時代の `poolOptions.forks.singleFork` 相当の挙動を、v4 では fileParallelism: false
    // + pool: "forks" (デフォルト明示) で表現している。
    pool: "forks",
    fileParallelism: false,
  },
});
