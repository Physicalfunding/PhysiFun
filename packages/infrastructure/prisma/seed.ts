/**
 * Prisma seed スクリプト (#140 / #144)
 *
 * 初期運営アカウント (AdminAccount) を 1 件作成する。
 * 開発環境 / preview / 新しい本番 DB の最初の 1 回だけ実行する想定。
 *
 * ## 使い方
 *
 * ```bash
 * # 必須: 初期 email / password
 * SEED_ADMIN_EMAIL="admin@example.com" \
 * SEED_ADMIN_PASSWORD="local-dev-password-16" \
 *   bun --cwd packages/infrastructure run db:seed
 * ```
 *
 * - `SEED_ADMIN_PASSWORD` は 16 文字以上を推奨 (運営アプリ.md)。
 * - 既に同一 email の AdminAccount が存在する場合は何もしない (冪等)。
 * - TOTP は初回ログイン時 (#146) に強制セットアップする前提のため、seed では
 *   `totpEnabled=false` / `totpSecret=null` / `recoveryCodes=[]` で作成する。
 */
import path from "node:path";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";

// DATABASE_URL は apps/web/.env.local と共有している (prisma.config.ts と同じ方針)。
// `dotenv` は既存の環境変数を上書きしない (override: false がデフォルト) ため、
// shell で DATABASE_URL 等が設定済みならそちらを優先する。
// .env.local → .env の順に読むのは、.env.local の方が優先度高と見做すため
// (最初にロードされた値が残るのを利用)。
//
// NOTE: monorepo ルートが変わるとこの相対パスは壊れる。
// CI や Docker 等で実行する場合は DATABASE_URL を明示的に env で渡すこと。
loadEnv({ path: path.resolve(__dirname, "../../../apps/web/.env.local") });
loadEnv({ path: path.resolve(__dirname, "../../../apps/web/.env") });

// Prisma Client の import は DATABASE_URL 読み込み後に行う (モジュールトップで
// $connect が走る前に env を整えておきたい)
const { prisma } = await import("../src/database/client");

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 16;

async function main(): Promise<void> {
  const email = requireEnv("SEED_ADMIN_EMAIL").trim().toLowerCase();
  const password = requireEnv("SEED_ADMIN_PASSWORD");

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_ADMIN_PASSWORD は ${MIN_PASSWORD_LENGTH} 文字以上にしてください (現在: ${password.length})`
    );
  }

  const existing = await prisma.adminAccount.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] AdminAccount already exists: ${email} (id=${existing.id}) — skip`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const created = await prisma.adminAccount.create({
    data: {
      email,
      passwordHash,
      totpEnabled: false,
      recoveryCodes: [],
      status: "ACTIVE",
    },
    select: { id: true, email: true },
  });

  console.log(`[seed] Created initial AdminAccount: ${created.email} (id=${created.id})`);
  console.log(
    `[seed] 初回ログイン時に TOTP セットアップを必ず行ってください (#146 で実装予定)。`
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
    await prisma.$disconnect();
  });
