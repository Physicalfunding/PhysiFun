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
    // fileParallelism を無効にしてテストファイルを直列実行する (初回導入時点の設計)。
    fileParallelism: false,
  },
});
