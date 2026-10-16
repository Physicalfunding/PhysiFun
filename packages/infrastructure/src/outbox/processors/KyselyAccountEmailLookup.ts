import { db } from "../../database/kysely/client";
import type { AccountEmailLookup } from "./types";

/**
 * Kysely を使った AccountEmailLookup 実装（Prisma 版からの移行 / #230）。
 *
 * accounts テーブルから accountId → email を解決する。
 */
export class KyselyAccountEmailLookup implements AccountEmailLookup {
  async findEmailByAccountId(accountId: string): Promise<string | null> {
    const row = await db
      .selectFrom("accounts")
      .select("email")
      .where("id", "=", accountId)
      .executeTakeFirst();
    return row?.email ?? null;
  }
}
