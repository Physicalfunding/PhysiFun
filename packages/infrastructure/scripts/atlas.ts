/**
 * Atlas CLI のラッパー（#229。旧 prisma.config.ts の env 読み込みを引き継ぐ）
 *
 * apps/web/.env.local（なければ .env）の DATABASE_URL などを読み込んでから、
 * 引数をそのまま `atlas` に渡して実行する。package.json の `db:migrate:*` から使う。
 *
 * ```bash
 * bun run db:migrate:diff add_some_column   # = atlas migrate diff add_some_column --env local
 * ```
 *
 * - `dotenv` は既存の環境変数を上書きしないため、shell / CI で設定済みの値が優先される。
 * - Atlas CLI 本体は別途インストールが必要（docs/guides/db-migration.md 参照）。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { config as loadEnv } from "dotenv";

const infraDir = path.resolve(__dirname, "..");
loadEnv({ path: path.resolve(infraDir, "../../apps/web/.env.local") });
loadEnv({ path: path.resolve(infraDir, "../../apps/web/.env") });

// atlas.hcl の相対パス（file://atlas/...）を解決できるよう、packages/infrastructure で実行する。
const result = spawnSync("atlas", process.argv.slice(2), { cwd: infraDir, stdio: "inherit" });

if (result.error) {
  const notFound = (result.error as NodeJS.ErrnoException).code === "ENOENT";
  console.error(
    notFound
      ? "[atlas] Atlas CLI が見つかりません。インストール方法は docs/guides/db-migration.md を参照してください。"
      : `[atlas] 実行に失敗しました: ${result.error.message}`
  );
  process.exit(1);
}
process.exit(result.status ?? 1);
