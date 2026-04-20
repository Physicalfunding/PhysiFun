import { PrismaClient } from "@prisma/client";

/**
 * integration test 用の PrismaClient ヘルパー (Issue #122)
 *
 * - globalSetup で DATABASE_URL が注入された後に参照されるため、テストファイルから遅延生成する
 * - 各テストの独立性を担保するため、public スキーマ配下の全テーブルを truncate するユーティリティを提供する
 *
 * NOTE: このシングルトン PrismaClient と `resetDatabase` による DB 状態共有は、
 *   `vitest.config.ts` の `fileParallelism: false` でテストファイルが直列実行されることを前提としている。
 *   並列実行を有効化する場合は worker ごとに PrismaClient を隔離する仕組みが必要になる。
 */
let client: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: ["error"],
    });
  }
  return client;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}

/**
 * テスト間のデータ汚染を避けるため、public スキーマの全テーブルを truncate する。
 *
 * 実装方針:
 * - information_schema から public スキーマのテーブル一覧を動的に取得する
 *   (スキーマ変更のたびにこのファイルをメンテする必要をなくすため)
 * - `_prisma_migrations` は migrate deploy が管理するテーブルなので除外する
 * - `TRUNCATE ... RESTART IDENTITY CASCADE` を 1 発で実行することで、
 *   FK の順序や `onDelete: Restrict` を意識せず高速にリセットできる
 *   (例: `SupportTicket.supporter` は `Account` に `onDelete: Restrict` だが、
 *   CASCADE TRUNCATE であれば supporter 側も同時に消えるため問題にならない)
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (rows.length === 0) {
    return;
  }

  // identifier を二重引用符で囲んで予約語・大文字混在を避ける
  const tableList = rows.map((row) => `"public"."${row.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}
