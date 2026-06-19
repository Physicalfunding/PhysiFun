import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "./types";

/**
 * Kysely クライアント シングルトン（PoC: project ドメイン移行）
 *
 * Prisma Client（`database/client.ts`）と同様に、Next.js の dev hot reload で
 * 接続プールが多重生成されないよう globalThis にキャッシュする。
 *
 * ## Supabase Transaction Pooler（pgBouncer）互換について
 * - `DATABASE_URL` は Transaction Pooler URL を想定（`.docs/tech.md`）。
 * - node-postgres は既定で **名前付き prepared statement を使わない**（unnamed
 *   extended protocol）。pgBouncer の transaction pooling と互換のため、Prisma の
 *   ような特別な設定（`pgbouncer=true`）は不要。
 * - 接続プール上限は環境変数 `KYSELY_POOL_MAX` で調整可能（既定 10）。
 *   サーバレス（Vercel/Lambda）では Pooler 側の上限と合わせて小さめにする。
 */
const globalForKysely = globalThis as unknown as {
  kyselyPool: Pool | undefined;
  kysely: Kysely<DB> | undefined;
};

function createPool(): Pool {
  return new Pool({
    // connectionString が未設定でも Pool は即時接続しない（最初のクエリで失敗）。
    // Prisma Client の遅延接続と挙動を合わせる。
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.KYSELY_POOL_MAX ?? 10),
  });
}

export const kyselyPool: Pool = globalForKysely.kyselyPool ?? createPool();

export const db: Kysely<DB> =
  globalForKysely.kysely ??
  new Kysely<DB>({
    dialect: new PostgresDialect({ pool: kyselyPool }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForKysely.kyselyPool = kyselyPool;
  globalForKysely.kysely = db;
}
