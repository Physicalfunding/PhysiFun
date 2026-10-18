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
 * - Atlas は URL に sslmode が無いと SSL 必須で接続する。ローカルの PostgreSQL（SSL 無効）に
 *   繋がるよう、localhost 宛てで sslmode 未指定の URL には sslmode=disable を補う。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { config as loadEnv } from "dotenv";

const infraDir = path.resolve(__dirname, "..");
loadEnv({ path: path.resolve(infraDir, "../../apps/web/.env.local") });
loadEnv({ path: path.resolve(infraDir, "../../apps/web/.env") });

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function disableSslForLocalHost(name: "DATABASE_URL" | "ATLAS_DEV_URL"): void {
  const value = process.env[name];
  if (!value) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return; // URL として解釈できないものはそのまま渡す
  }
  if (!LOCAL_HOSTS.has(url.hostname) || url.searchParams.has("sslmode")) return;
  url.searchParams.set("sslmode", "disable");
  process.env[name] = url.toString();
}

disableSslForLocalHost("DATABASE_URL");
disableSslForLocalHost("ATLAS_DEV_URL");

// atlas.hcl の相対パス（file://atlas/...）を解決できるよう、packages/infrastructure で実行する。
// Bun では env を明示しないと、上で読み込み・補完した process.env が子プロセスに渡らない（#288）。
const result = spawnSync("atlas", process.argv.slice(2), {
  cwd: infraDir,
  stdio: "inherit",
  env: process.env,
});

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
