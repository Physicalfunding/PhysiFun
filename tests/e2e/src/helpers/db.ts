import { randomUUID } from "node:crypto";
import { kyselyDb as db } from "@physifun/infrastructure";
import { TEST_ADMIN } from "../fixtures";

/**
 * E2E 用の DB ヘルパー（#230 で Prisma から Kysely へ移行）
 *
 * NOTE: `id` / `updatedAt` は DB 側に DEFAULT が無い（旧 Prisma はクライアント側で埋めていた）ため、
 * INSERT 時は明示的に渡す。
 */

/**
 * 全テーブルを FK 依存順で空にする。
 *
 * 一括 TRUNCATE ではなく 1 テーブルずつ DELETE するのは、FK の削除順を明示的に
 * コントロールするため（テスト用途では速度は十分）。
 */
const TABLES_IN_DELETE_ORDER = [
  // FK の子から親の順序で削除する
  "support_tickets",
  "recruitment_schedules",
  "support_recruitments",
  // Project / LeaderApplication は AdminAccount を reviewer として参照する (onDelete: Restrict)
  // ため、AdminAccount 削除より先に消す必要がある。
  "project_review_feedbacks",
  "project_outbox_messages",
  "projects",
  "leader_application_outbox_messages",
  "leader_applications",
  "accounts",
  // AdminAccount 系は Account から独立 (#140 / #144 / #145)。
  // auditLog は adminAccountId を Restrict 参照しているため adminAccount より先に消す。
  "admin_audit_logs",
  "admin_sessions",
  "admin_verification_tokens",
  "admin_accounts",
] as const;

export async function truncateAll(): Promise<void> {
  for (const table of TABLES_IN_DELETE_ORDER) {
    await db.deleteFrom(table).execute();
  }
}

/**
 * E2E 用の運営アカウント (AdminAccount) を seed する (#140 / #144 / #145)。
 *
 * #145 でマジックリンク方式に切替したためパスワードは不要。
 * E2E ではマジックリンクのメール送信フローを経由せず、`seedAdminSession` で
 * AdminSession 行を直接 INSERT してログイン済み状態にする。
 */
export async function seedAdminAccount(): Promise<{
  id: string;
  email: string;
}> {
  return db
    .insertInto("admin_accounts")
    .values({ id: randomUUID(), email: TEST_ADMIN.email, status: "ACTIVE", updatedAt: new Date() })
    .returning(["id", "email"])
    .executeTakeFirstOrThrow();
}

/**
 * 指定 email の AdminAccount を作成、または既存行の status を更新する（upsert）。
 *
 * spec 間で状態を引き継がないよう、各 spec の冒頭で使う。
 */
export async function upsertAdminAccount(
  email: string,
  status: "ACTIVE" | "DISABLED"
): Promise<{ id: string }> {
  const now = new Date();
  return db
    .insertInto("admin_accounts")
    .values({ id: randomUUID(), email, status, updatedAt: now })
    .onConflict((oc) => oc.column("email").doUpdateSet({ status, updatedAt: now }))
    .returning("id")
    .executeTakeFirstOrThrow();
}

/** 指定 email 宛ての AdminVerificationToken をすべて削除する。 */
export async function deleteVerificationTokens(email: string): Promise<void> {
  await db.deleteFrom("admin_verification_tokens").where("identifier", "=", email).execute();
}

/** 指定 email 宛ての AdminVerificationToken の件数を返す。 */
export async function countVerificationTokens(email: string): Promise<number> {
  const row = await db
    .selectFrom("admin_verification_tokens")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("identifier", "=", email)
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

/** 指定 email の AdminAccount に紐づく AdminSession を返す。 */
export async function findAdminSessionsByEmail(email: string): Promise<{ sessionToken: string }[]> {
  return db
    .selectFrom("admin_sessions")
    .innerJoin("admin_accounts", "admin_accounts.id", "admin_sessions.adminAccountId")
    .select("admin_sessions.sessionToken")
    .where("admin_accounts.email", "=", email)
    .execute();
}

/**
 * E2E 用にログイン済みセッションを DB 直接作成する (#145)。
 *
 * NextAuth Database 戦略では `next-auth.session-token` Cookie の値が
 * AdminSession.sessionToken と一致する行を見つけたらログイン済みと判定される。
 * マジックリンクのメール受信・クリックをテスト内でエミュレートすると複雑になるため、
 * セッションレコードを直接 INSERT して Cookie 経由でログインを偽装する。
 *
 * @returns sessionToken (Playwright の context.addCookies で注入する値)
 */
export async function seedAdminSession(params: {
  adminAccountId: string;
  expiresInMs?: number;
}): Promise<{ sessionToken: string; expires: Date }> {
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + (params.expiresInMs ?? 60 * 60 * 1000));
  await db
    .insertInto("admin_sessions")
    .values({
      id: randomUUID(),
      sessionToken,
      adminAccountId: params.adminAccountId,
      expires,
      updatedAt: new Date(),
    })
    .execute();
  return { sessionToken, expires };
}

export { db };
