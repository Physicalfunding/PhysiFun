import { randomUUID } from "node:crypto";
import { sql, type Insertable, type Selectable } from "kysely";
import { db } from "../../src/database/kysely/client";
import type { DB } from "../../src/database/kysely/types";

/**
 * integration test 用の DB ヘルパー (Issue #122。#230 で Prisma から Kysely へ移行)
 *
 * - 接続はアプリと同じ Kysely シングルトン（`db`）を使う。globalSetup で DATABASE_URL が
 *   注入された後にテストファイルから import されるため、テスト用 DB を参照する。
 * - 各テストの独立性を担保するため、public スキーマ配下の全テーブルを truncate するユーティリティを提供する。
 *
 * NOTE: シングルトン接続と `resetDatabase` による DB 状態共有は、
 *   `vitest.config.ts` の `fileParallelism: false` でテストファイルが直列実行されることを前提としている。
 */
export { db };

/**
 * テスト間のデータ汚染を避けるため、public スキーマの全テーブルを truncate する。
 *
 * 実装方針:
 * - pg_tables から public スキーマのテーブル一覧を動的に取得する
 *   (スキーマ変更のたびにこのファイルをメンテする必要をなくすため)
 * - マイグレーションツールの管理テーブル（`_prisma_migrations` など `_` 始まり）は除外する
 * - `TRUNCATE ... RESTART IDENTITY CASCADE` を 1 発で実行することで、
 *   FK の順序や `onDelete: Restrict` を意識せず高速にリセットできる
 */
export async function resetDatabase(): Promise<void> {
  const { rows } = await sql<{ tablename: string }>`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '\\_%'
  `.execute(db);

  if (rows.length === 0) {
    return;
  }

  // identifier を二重引用符で囲んで予約語・大文字混在を避ける
  const tableList = rows.map((row) => `"public"."${row.tablename}"`).join(", ");
  await sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`).execute(db);
}

// ==================== テストデータ投入 ====================

/**
 * `id` / `updatedAt` は DB 側に DEFAULT が無い（旧 Prisma の `@default(uuid())` / `@updatedAt` は
 * クライアント側で値を埋めていた）。テストのデータ投入では省略可能にして、ここで補う。
 */
type AutoFilled = "id" | "updatedAt";
export type SeedValues<T extends keyof DB> = Omit<Insertable<DB[T]>, AutoFilled> &
  Partial<Pick<Insertable<DB[T]>, Extract<keyof Insertable<DB[T]>, AutoFilled>>>;

const TABLES_WITHOUT_ID: ReadonlySet<keyof DB> = new Set(["admin_verification_tokens"]);
const TABLES_WITH_UPDATED_AT: ReadonlySet<keyof DB> = new Set([
  "accounts",
  "leader_applications",
  "projects",
  "support_recruitments",
  "recruitment_schedules",
  "support_tickets",
  "admin_accounts",
  "admin_sessions",
]);

function withAutoFields<T extends keyof DB>(
  table: T,
  values: SeedValues<T>
): Record<string, unknown> {
  const row: Record<string, unknown> = { ...values };
  if (!TABLES_WITHOUT_ID.has(table) && row.id === undefined) row.id = randomUUID();
  if (TABLES_WITH_UPDATED_AT.has(table) && row.updatedAt === undefined) row.updatedAt = new Date();
  return row;
}

/** 1 行 INSERT して、挿入した行を返す。 */
export async function insertRow<T extends keyof DB>(
  table: T,
  values: SeedValues<T>
): Promise<Selectable<DB[T]>> {
  const row = await db
    .insertInto(table)
    .values(withAutoFields(table, values) as never)
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as Selectable<DB[T]>;
}

/** 複数行をまとめて INSERT する。 */
export async function insertRows<T extends keyof DB>(
  table: T,
  values: readonly SeedValues<T>[]
): Promise<void> {
  if (values.length === 0) return;
  await db
    .insertInto(table)
    .values(values.map((v) => withAutoFields(table, v)) as never)
    .execute();
}
