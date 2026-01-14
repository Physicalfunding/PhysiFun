import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client singleton pattern for connection pooling
 *
 * シングルトンパターンを使用してNext.jsの開発モードで
 * 複数のPrismaClientインスタンスが作成されるのを防ぐ
 *
 * 接続プール設定:
 * - DATABASE_URLにconnection_limitパラメータを追加可能
 *   例: DATABASE_URL="postgresql://...?connection_limit=10"
 *
 * パフォーマンス最適化:
 * - 開発環境: クエリログ有効
 * - 本番環境: エラーログのみ
 *
 * @see https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/connection-pool
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma Client インスタンス
 *
 * 本番環境ではログレベルを最小限に抑えてパフォーマンスを向上
 * 開発環境ではクエリログを有効にしてデバッグを容易に
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    // 接続タイムアウト設定（デフォルト: 20秒）
    // DATABASE_URLにconnect_timeoutパラメータで設定可能
  });

// 開発環境でのホットリロード時の接続プール問題を回避
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
