import { PrismaClient, type Prisma } from "@prisma/client";

/**
 * Prisma Client シングルトン
 *
 * Next.js の dev hot reload で複数インスタンスが生成されないように
 * globalThis にキャッシュする。
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * ログレベル設定:
 * - 本番: error のみ
 * - dev 既定: error + warn (クエリは PII/パスワードハッシュを含む可能性があるので既定ではログ出力しない)
 * - `PRISMA_LOG_QUERIES=1` を明示した場合のみ query を有効化
 */
function resolveLogLevels(): Prisma.LogLevel[] {
  if (process.env.NODE_ENV === "production") {
    return ["error"];
  }
  const base: Prisma.LogLevel[] = ["error", "warn"];
  if (process.env.PRISMA_LOG_QUERIES === "1") {
    base.push("query");
  }
  return base;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: resolveLogLevels(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
