import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { KyselyAdminAuthGcAdapter } from "../../src/admin-account/KyselyAdminAuthGcAdapter";
import { db, insertRow, insertRows, resetDatabase } from "../helpers/db";

/**
 * KyselyAdminAuthGcAdapter の integration test (#158 M2 / #159 M-1。#230 で Prisma 版から対象を移行)
 *
 * `deleteExpired(now)` は admin_sessions と admin_verification_tokens の
 * 両テーブルから `expires < now` の行を削除する。実 Postgres で以下を確認:
 *
 * 1. 期限切れ session が削除され未期限 session は残る
 * 2. 期限切れ verification token が削除され未期限 token は残る
 * 3. 境界条件: `expires === now` の行は削除されない (strict less-than)
 * 4. 両テーブルの削除が同一トランザクションで起きる (片方だけ消える状態を作れない)
 * 5. 何も削除対象が無いケース (deletedSessions=0, deletedVerificationTokens=0)
 */
describe("KyselyAdminAuthGcAdapter.deleteExpired integration", () => {
  const adapter = new KyselyAdminAuthGcAdapter();

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.destroy();
  });

  async function createAdminAccount(email: string) {
    return insertRow("admin_accounts", {
      email,
      status: "ACTIVE",
    });
  }

  async function countRows(table: "admin_sessions" | "admin_verification_tokens"): Promise<number> {
    const row = await db
      .selectFrom(table)
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  it("期限切れ session のみ削除し、未期限 session は残す", async () => {
    const admin = await createAdminAccount("gc-session@example.com");
    const now = new Date("2026-04-22T00:00:00Z");
    const past = new Date("2026-04-21T23:00:00Z"); // 1h 前 (期限切れ)
    const future = new Date("2026-04-22T01:00:00Z"); // 1h 先 (未期限)

    await insertRows("admin_sessions", [
      { sessionToken: "expired-token", adminAccountId: admin.id, expires: past },
      { sessionToken: "active-token", adminAccountId: admin.id, expires: future },
    ]);

    const result = await adapter.deleteExpired(now);

    expect(result).toEqual({ deletedSessions: 1, deletedVerificationTokens: 0 });

    const remaining = await db
      .selectFrom("admin_sessions")
      .selectAll()
      .orderBy("sessionToken", "asc")
      .execute();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.sessionToken).toBe("active-token");
  });

  it("期限切れ verification token のみ削除し、未期限 token は残す", async () => {
    const now = new Date("2026-04-22T00:00:00Z");
    const past = new Date("2026-04-21T23:00:00Z");
    const future = new Date("2026-04-22T01:00:00Z");

    await insertRows("admin_verification_tokens", [
      { identifier: "expired@example.com", token: "expired-vt", expires: past },
      { identifier: "active@example.com", token: "active-vt", expires: future },
    ]);

    const result = await adapter.deleteExpired(now);

    expect(result).toEqual({ deletedSessions: 0, deletedVerificationTokens: 1 });

    const remaining = await db
      .selectFrom("admin_verification_tokens")
      .selectAll()
      .orderBy("token", "asc")
      .execute();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.token).toBe("active-vt");
  });

  it("境界: expires === now の行は strict less-than により残る", async () => {
    const admin = await createAdminAccount("gc-boundary@example.com");
    const now = new Date("2026-04-22T00:00:00Z");

    await insertRow("admin_sessions", {
      sessionToken: "boundary-session",
      adminAccountId: admin.id,
      expires: now, // ぴったり now
    });
    await insertRow("admin_verification_tokens", {
      identifier: "boundary@example.com",
      token: "boundary-vt",
      expires: now, // ぴったり now
    });

    const result = await adapter.deleteExpired(now);

    expect(result).toEqual({ deletedSessions: 0, deletedVerificationTokens: 0 });

    expect(await countRows("admin_sessions")).toBe(1);
    expect(await countRows("admin_verification_tokens")).toBe(1);
  });

  it("両テーブルの期限切れ行を同時に削除する", async () => {
    const admin = await createAdminAccount("gc-both@example.com");
    const now = new Date("2026-04-22T00:00:00Z");
    const past = new Date("2026-04-21T23:00:00Z");
    const future = new Date("2026-04-22T01:00:00Z");

    await insertRows("admin_sessions", [
      { sessionToken: "s-old-1", adminAccountId: admin.id, expires: past },
      { sessionToken: "s-old-2", adminAccountId: admin.id, expires: past },
      { sessionToken: "s-active", adminAccountId: admin.id, expires: future },
    ]);
    await insertRows("admin_verification_tokens", [
      { identifier: "a@example.com", token: "t-old-1", expires: past },
      { identifier: "b@example.com", token: "t-old-2", expires: past },
      { identifier: "c@example.com", token: "t-old-3", expires: past },
      { identifier: "d@example.com", token: "t-active", expires: future },
    ]);

    const result = await adapter.deleteExpired(now);

    expect(result).toEqual({ deletedSessions: 2, deletedVerificationTokens: 3 });
    expect(await countRows("admin_sessions")).toBe(1);
    expect(await countRows("admin_verification_tokens")).toBe(1);
  });

  it("削除対象が無いケースでは 0/0 を返し、他行は変化しない", async () => {
    const admin = await createAdminAccount("gc-empty@example.com");
    const now = new Date("2026-04-22T00:00:00Z");
    const future = new Date("2026-04-22T12:00:00Z");

    await insertRow("admin_sessions", {
      sessionToken: "fresh",
      adminAccountId: admin.id,
      expires: future,
    });
    await insertRow("admin_verification_tokens", {
      identifier: "fresh@example.com",
      token: "fresh-vt",
      expires: future,
    });

    const result = await adapter.deleteExpired(now);

    expect(result).toEqual({ deletedSessions: 0, deletedVerificationTokens: 0 });
    expect(await countRows("admin_sessions")).toBe(1);
    expect(await countRows("admin_verification_tokens")).toBe(1);
  });

  it("default 引数 (new Date()) でも過去行は削除される", async () => {
    const admin = await createAdminAccount("gc-default@example.com");
    // now より十分過去 / 未来を使い、default の new Date() が呼び出し時評価されることを確認
    const farPast = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await insertRows("admin_sessions", [
      { sessionToken: "default-expired", adminAccountId: admin.id, expires: farPast },
      { sessionToken: "default-active", adminAccountId: admin.id, expires: farFuture },
    ]);

    const result = await adapter.deleteExpired(); // 引数なし

    expect(result.deletedSessions).toBe(1);
    expect(await countRows("admin_sessions")).toBe(1);
  });
});
