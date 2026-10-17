/**
 * Liam ERD（動く ER 図）のビルド（#273）
 *
 * docs/db/schema.json（tbls の生成物。`bun run db:docs` で作る）から、Liam ERD の静的サイトを dist/erd/ に作る。
 * DB ドキュメントサイト（apps/docs-site）が /er/ に取り込み、.github/workflows/docs-site.yml が GitHub Pages に公開する。
 * 手順は docs/guides/db-migration.md §6 を参照。
 *
 * ```bash
 * bun run db:erd          # dist/erd/ を作る
 * npx serve dist/erd      # ブラウザで確認する（リポジトリのルートで実行）
 * ```
 *
 * - Node.js（npx）が必要。Liam ERD の CLI は LIAM_CLI のバージョンで固定している
 * - Liam ERD 0.7.24 は tbls の `viewpoints[].id` を受け付けずに失敗するため、取り除いた一時ファイルを渡す
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const LIAM_CLI = "@liam-hq/cli@0.7.24";

const repoRoot = path.resolve(__dirname, "../../..");
const schemaJsonPath = path.join(repoRoot, "docs/db/schema.json");
const outDir = path.join(repoRoot, "dist/erd");

function main(): void {
  const tmpDir = mkdtempSync(path.join(tmpdir(), "physifun-erd-"));
  try {
    const schema = JSON.parse(readFileSync(schemaJsonPath, "utf8"));
    for (const viewpoint of schema.viewpoints ?? []) delete viewpoint.id;
    const input = path.join(tmpDir, "schema.json");
    writeFileSync(input, JSON.stringify(schema));

    rmSync(outDir, { recursive: true, force: true });
    const result = spawnSync(
      "npx",
      [
        "--yes",
        LIAM_CLI,
        "erd",
        "build",
        "--format",
        "tbls",
        "--input",
        input,
        "--output-dir",
        outDir,
      ],
      { cwd: repoRoot, stdio: "inherit" }
    );
    if (result.error || result.status !== 0) {
      throw new Error(
        result.error
          ? `npx の実行に失敗しました（Node.js が必要です）: ${result.error.message}`
          : `Liam ERD のビルドが終了コード ${result.status} で失敗しました`
      );
    }
    console.log(`[db:erd] ${path.relative(repoRoot, outDir)}/ に出力しました`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`[db:erd] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
