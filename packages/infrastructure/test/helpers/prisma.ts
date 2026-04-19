import { PrismaClient } from "@prisma/client";

/**
 * integration test 用の PrismaClient ヘルパー (Issue #122)
 *
 * - globalSetup で DATABASE_URL が注入された後に参照されるため、テストファイルから遅延生成する
 * - 各テストの独立性を担保するため、主要テーブルを truncate するユーティリティを提供する
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
 * テスト間のデータ汚染を避けるため、主要テーブルを truncate する。
 *
 * 依存関係順 (FK 下流 → 上流) に DELETE していく。Prisma の `$executeRawUnsafe` を使用。
 * TRUNCATE ... CASCADE を使うと速いが、権限上の都合を避けて素朴に DELETE している。
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  // 参照される側 → 参照する側 の順番で消す
  await prisma.projectReviewFeedback.deleteMany();
  await prisma.projectOutboxMessage.deleteMany();
  await prisma.leaderApplicationOutboxMessage.deleteMany();
  await prisma.project.deleteMany();
  await prisma.leaderApplication.deleteMany();
  await prisma.account.deleteMany();
}
