/**
 * 初期データ投入（seed）スクリプト (#140 / #144 / #145。#230 で Kysely 化)
 *
 * 初期運営アカウント (AdminAccount) を 1 件作成する。
 * 開発環境 / preview / 新しい本番 DB の最初の 1 回だけ実行する想定。
 *
 * ## 使い方
 *
 * ```bash
 * # 必須: 初期 email
 * SEED_ADMIN_EMAIL="admin@example.com" \
 *   bun run db:seed
 * ```
 *
 * - #145 でマジックリンク方式に切替したためパスワードは不要。
 * - 既に同一 email の AdminAccount が存在する場合は何もしない (冪等)。
 * - email は trim + toLowerCase で正規化して保存する (NextAuth 側と一致させる)。
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { config as loadEnv } from "dotenv";

// DATABASE_URL は apps/web/.env.local と共有している。
// `dotenv` は既存の環境変数を上書きしない (override: false がデフォルト) ため、
// shell で DATABASE_URL 等が設定済みならそちらを優先する。
// .env.local → .env の順に読むのは、.env.local の方が優先度高と見做すため
// (最初にロードされた値が残るのを利用)。
loadEnv({ path: path.resolve(__dirname, "../../../apps/web/.env.local") });
loadEnv({ path: path.resolve(__dirname, "../../../apps/web/.env") });

// Kysely クライアントは import 時に DATABASE_URL を読むため、env 読み込み後に動的 import する。
const { db } = await import("../src/database/kysely/client");

async function main(): Promise<void> {
  const email = requireEnv("SEED_ADMIN_EMAIL").trim().toLowerCase();

  const existing = await db
    .selectFrom("admin_accounts")
    .select("id")
    .where("email", "=", email)
    .executeTakeFirst();
  if (existing) {
    console.log(`[seed] AdminAccount already exists: ${email} (id=${existing.id}) — skip`);
    return;
  }

  // id / updatedAt は DB 側に DEFAULT が無いため明示的に渡す。
  const created = await db
    .insertInto("admin_accounts")
    .values({ id: randomUUID(), email, status: "ACTIVE", updatedAt: new Date() })
    .returning(["id", "email"])
    .executeTakeFirstOrThrow();

  console.log(`[seed] Created initial AdminAccount: ${created.email} (id=${created.id})`);
  console.log(
    `[seed] ログイン時は /login でメールを入力しマジックリンクを利用してください (#145)。`
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} 環境変数を設定してください`);
  }
  return value;
}

main()
  .catch((error) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
