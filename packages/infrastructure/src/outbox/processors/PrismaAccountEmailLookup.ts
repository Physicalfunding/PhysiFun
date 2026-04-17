import type { PrismaClient } from "@prisma/client";
import type { AccountEmailLookup } from "./types";

/**
 * Prisma を使った AccountEmailLookup 実装。
 *
 * accounts テーブルから accountId → email を解決する。
 */
export class PrismaAccountEmailLookup implements AccountEmailLookup {
  constructor(private readonly prisma: PrismaClient) {}

  async findEmailByAccountId(accountId: string): Promise<string | null> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { email: true },
    });
    return account?.email ?? null;
  }
}
