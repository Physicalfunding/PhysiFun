import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client シングルトン
 *
 * Next.js の dev hot reload で複数インスタンスが生成されないように
 * globalThis にキャッシュする。
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
