/**
 * DB テーブル定義書・ER 図の生成（tbls のラッパー。#261）
 *
 * 使い捨ての PostgreSQL に Atlas のマイグレーションを流し、tbls で docs/db/ を再生成する。
 * 設定は `.tbls.yml`、運用手順は docs/guides/db-migration.md を参照。
 *
 * ```bash
 * bun run db:docs            # docs/db/ を再生成し、lint（説明文の付け忘れなど）の結果を表示する
 * bun run db:docs --strict   # lint 違反があれば失敗する
 * ```
 *
 * - DB: `DB_DOCS_DATABASE_URL` があればそれを使う（CI のサービスコンテナなど。中身が空の DB を渡すこと）。
 *   無ければ Testcontainers で PostgreSQL を起動する（Docker が必要）。
 * - tbls: PATH に `tbls` があればそれを使う。無ければ Docker イメージ（TBLS_IMAGE）で実行する。
 * - Atlas CLI が必要（マイグレーションの適用に使う）。
 * - Atlas の適用履歴スキーマ（atlas_schema_revisions）は、生成前に使い捨て DB から削除する
 *   （ドキュメントに混ざらないようにするため）。
 */
import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

/** Docker で tbls を動かすときのイメージ。CI（setup-tbls の version）と揃える */
const TBLS_IMAGE = "ghcr.io/k1low/tbls:v1.96.1";

const infraDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(infraDir, "../..");
const strict = process.argv.includes("--strict");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

async function main(): Promise<void> {
  const { databaseUrl, stop } = await prepareDatabase();
  try {
    const url = withSslDisabled(databaseUrl);

    console.log("[db:docs] マイグレーションを適用します");
    run("atlas", ["migrate", "apply", "--env", "local"], {
      cwd: infraDir,
      env: { ...process.env, DATABASE_URL: url },
    });
    await dropAtlasRevisionsSchema(url);

    console.log("[db:docs] docs/db/ を再生成します");
    const tbls = resolveTblsRunner(url);
    run(tbls.command, [...tbls.args, "doc", "--rm-dist", ...tbls.connectionArgs]);
    normalizeSchemaJson();

    console.log("[db:docs] lint を実行します");
    const lint = spawnSync(tbls.command, [...tbls.args, "lint", ...tbls.connectionArgs], {
      cwd: infraDir,
      stdio: "inherit",
    });
    if (lint.status !== 0) {
      if (strict) throw new Error("tbls lint で違反が見つかりました（上の出力を参照）");
      console.warn(
        "[db:docs] lint で違反が見つかりました（警告のみ。--strict を付けると失敗扱い）"
      );
    }
  } finally {
    await stop?.();
  }
}

/**
 * DB_DOCS_DATABASE_URL があればそれを、無ければ Docker で使い捨ての PostgreSQL を起動して使う。
 * （Testcontainers は Bun 上で起動が止まってしまうため、docker CLI を直接使う）
 */
async function prepareDatabase(): Promise<{
  databaseUrl: string;
  stop?: () => Promise<void>;
}> {
  const external = process.env.DB_DOCS_DATABASE_URL;
  if (external) return { databaseUrl: external };

  console.log("[db:docs] 使い捨ての PostgreSQL を起動します（Docker が必要）");
  const containerId = capture("docker", [
    "run",
    "--detach",
    "--rm",
    "--env",
    "POSTGRES_USER=docs",
    "--env",
    "POSTGRES_PASSWORD=docs",
    "--env",
    "POSTGRES_DB=physifun_docs",
    "--publish",
    "127.0.0.1::5432",
    "postgres:16-alpine",
  ]);
  const stop = async (): Promise<void> => {
    spawnSync("docker", ["rm", "--force", containerId], { stdio: "ignore" });
  };
  try {
    // "127.0.0.1:54321" の形で、ホスト側に割り当てられたポートが返る
    const hostPort = capture("docker", ["port", containerId, "5432/tcp"]).split("\n")[0];
    const databaseUrl = `postgres://docs:docs@${hostPort}/physifun_docs?sslmode=disable`;
    await waitForDatabase(databaseUrl);
    return { databaseUrl, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

/**
 * 公式イメージは初期化のために一度サーバーを再起動する。初期化中のサーバーは TCP を受け付けないので、
 * TCP で接続できてクエリが通れば準備完了とみなす。
 */
async function waitForDatabase(databaseUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new pg.Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      await client.query("SELECT 1");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  throw new Error("PostgreSQL が 30 秒以内に起動しませんでした");
}

/** Atlas / tbls は sslmode 未指定だと SSL で接続しようとするため、ローカル DB 向けに無効化する */
function withSslDisabled(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "disable");
  return url.toString();
}

async function dropAtlasRevisionsSchema(databaseUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS atlas_schema_revisions CASCADE");
  } finally {
    await client.end();
  }
}

/**
 * schema.json から、生成した環境によって変わる値を取り除く。
 * そのままだと、ローカル（arm64 / alpine）と CI（x86_64 / debian）で中身が変わり、再生成のたびに差分が出るため。
 * - driver.database_version: PostgreSQL のバージョン・CPU・コンパイラの文字列
 * - driver.meta.search_paths: 接続ユーザー名（"$user"）を含む検索パス
 */
function normalizeSchemaJson(): void {
  const schemaJsonPath = path.join(repoRoot, "docs/db/schema.json");
  const schema = JSON.parse(readFileSync(schemaJsonPath, "utf8"));
  delete schema.driver?.database_version;
  if (schema.driver?.meta) schema.driver.meta.search_paths = ["public"];
  writeFileSync(schemaJsonPath, `${JSON.stringify(schema, null, 2)}\n`);
}

/**
 * tbls の実行方法を決める。
 * PATH に tbls があればそのまま、無ければ Docker で動かす（コンテナからホストの DB に届くよう DSN のホストを差し替える）。
 */
function resolveTblsRunner(databaseUrl: string): {
  command: string;
  args: string[];
  connectionArgs: string[];
} {
  const installed = spawnSync("tbls", ["version"], { stdio: "ignore" });
  if (!installed.error) {
    return {
      command: "tbls",
      args: [],
      connectionArgs: ["--config", ".tbls.yml", "--dsn", databaseUrl],
    };
  }

  const dsn = new URL(databaseUrl);
  if (LOCAL_HOSTS.has(dsn.hostname)) dsn.hostname = "host.docker.internal";
  const user =
    typeof process.getuid === "function" && typeof process.getgid === "function"
      ? ["--user", `${process.getuid()}:${process.getgid()}`]
      : [];
  return {
    command: "docker",
    args: [
      "run",
      "--rm",
      "--add-host=host.docker.internal:host-gateway",
      ...user,
      "-v",
      `${repoRoot}:/work`,
      "-w",
      "/work/packages/infrastructure",
      TBLS_IMAGE,
    ],
    connectionArgs: ["--config", ".tbls.yml", "--dsn", dsn.toString()],
  };
}

function run(command: string, args: string[], options: SpawnSyncOptions = {}): void {
  const result = spawnSync(command, args, { cwd: infraDir, stdio: "inherit", ...options });
  if (result.error) {
    const notFound = (result.error as NodeJS.ErrnoException).code === "ENOENT";
    throw new Error(
      notFound
        ? `${command} が見つかりません。docs/guides/db-migration.md の「DB ドキュメント」を参照してください。`
        : `${command} の実行に失敗しました: ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} が終了コード ${result.status} で失敗しました`);
  }
}

/** コマンドを実行して標準出力（前後の空白を除く）を返す */
function capture(command: string, args: string[]): string {
  const result = spawnSync(command, args, { cwd: infraDir, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr.trim();
    throw new Error(`${command} ${args[0]} に失敗しました: ${detail}`);
  }
  return result.stdout.trim();
}

main().catch((error: unknown) => {
  console.error(`[db:docs] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
