import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ok, err, type Result } from "@physifun/domain";
import { KyselyOutboxDelegate } from "../../src/outbox/KyselyOutboxDelegate";
import { OutboxWorkerBase } from "../../src/outbox/OutboxWorkerBase";
import type { OutboxProcessError, OutboxProcessor } from "../../src/outbox/types";
import { KyselyOutboxQueryService } from "../../src/outbox/admin/KyselyOutboxQueryService";
import { KyselyOutboxCommandAdapter } from "../../src/outbox/admin/KyselyOutboxCommandAdapter";
import { db } from "../../src/database/kysely/client";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * Kysely 版 Outbox 実装の integration test（#226）
 *
 * - シードは Prisma、検証対象は Kysely（delegate / QueryService / CommandAdapter）。
 * - 実 PostgreSQL（Testcontainers）に対して、`FOR UPDATE SKIP LOCKED` の atomic claim・
 *   並行 claim の非二重化・送信/リトライ/dead-letter の round-trip を確認する。
 */
const TABLE = "leader_application_outbox_messages" as const;

describe("Kysely Outbox 実装 integration", () => {
  const prisma = getTestPrisma();

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await db.destroy();
    await disconnectTestPrisma();
  });

  async function seed(overrides?: {
    id?: string;
    type?: string;
    payload?: unknown;
    createdAt?: Date;
    sentAt?: Date | null;
    attempts?: number;
    lastError?: string | null;
    nextRetryAt?: Date | null;
    deadLetteredAt?: Date | null;
    claimedAt?: Date | null;
    claimedBy?: string | null;
  }): Promise<string> {
    const id = overrides?.id ?? randomUUID();
    await prisma.leaderApplicationOutboxMessage.create({
      data: {
        id,
        type: overrides?.type ?? "ACTIVATION_EMAIL",
        payload: (overrides?.payload ?? { email: "x@example.com" }) as object,
        ...(overrides?.createdAt ? { createdAt: overrides.createdAt } : {}),
        sentAt: overrides?.sentAt ?? null,
        attempts: overrides?.attempts ?? 0,
        lastError: overrides?.lastError ?? null,
        nextRetryAt: overrides?.nextRetryAt ?? null,
        deadLetteredAt: overrides?.deadLetteredAt ?? null,
        claimedAt: overrides?.claimedAt ?? null,
        claimedBy: overrides?.claimedBy ?? null,
      },
    });
    return id;
  }

  function claimParams(batchSize = 20, token = randomUUID()) {
    return {
      now: new Date(),
      claimExpiry: new Date(Date.now() - 5 * 60 * 1000),
      claimToken: token,
      batchSize,
    };
  }

  function stubProcessor(type: string, result: Result<void, OutboxProcessError>): OutboxProcessor {
    return {
      type,
      async process() {
        return result;
      },
    };
  }

  describe("claimBatch（FOR UPDATE SKIP LOCKED）", () => {
    it("対象行を claim して返し、claimedAt / claimedBy を set する", async () => {
      const id = await seed();
      const token = randomUUID();
      const delegate = new KyselyOutboxDelegate(TABLE);

      const rows = await delegate.claimBatch(claimParams(20, token));

      expect(rows.map((r) => r.id)).toEqual([id]);
      const row = await db
        .selectFrom(TABLE)
        .select(["claimedBy", "claimedAt"])
        .where("id", "=", id)
        .executeTakeFirstOrThrow();
      expect(row.claimedBy).toBe(token);
      expect(row.claimedAt).not.toBeNull();
    });

    it("sent / dead-lettered / 未来 nextRetryAt / fresh claim の行は除外する", async () => {
      const target = await seed();
      await seed({ sentAt: new Date() });
      await seed({ deadLetteredAt: new Date() });
      await seed({ nextRetryAt: new Date(Date.now() + 60 * 60 * 1000) });
      await seed({ claimedAt: new Date(), claimedBy: "other-worker" });

      const delegate = new KyselyOutboxDelegate(TABLE);
      const rows = await delegate.claimBatch(claimParams());

      expect(rows.map((r) => r.id)).toEqual([target]);
    });

    it("並行 claim で同一行を二重 claim しない（SKIP LOCKED）", async () => {
      for (let i = 0; i < 4; i++) {
        await seed({ createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`) });
      }
      const delegate = new KyselyOutboxDelegate(TABLE);

      const [a, b] = await Promise.all([
        delegate.claimBatch(claimParams(2)),
        delegate.claimBatch(claimParams(2)),
      ]);

      const aIds = a.map((r) => r.id);
      const bIds = b.map((r) => r.id);
      // 二重 claim なし（disjoint）
      expect(aIds.filter((x) => bIds.includes(x))).toEqual([]);
      // claim 済み行はすべてユニーク
      expect(new Set([...aIds, ...bIds]).size).toBe(aIds.length + bIds.length);
    });
  });

  describe("update", () => {
    it("sentAt + claim 解放 / attempts / deadLetteredAt を反映する", async () => {
      const id = await seed({ claimedAt: new Date(), claimedBy: "tok", attempts: 1 });
      const delegate = new KyselyOutboxDelegate(TABLE);

      await delegate.update(id, { sentAt: new Date(), releaseClaim: true });
      const row1 = await db
        .selectFrom(TABLE)
        .select(["sentAt", "claimedAt", "claimedBy"])
        .where("id", "=", id)
        .executeTakeFirstOrThrow();
      expect(row1.sentAt).not.toBeNull();
      expect(row1.claimedAt).toBeNull();
      expect(row1.claimedBy).toBeNull();

      const id2 = await seed({ attempts: 2 });
      await delegate.update(id2, {
        attempts: 3,
        lastError: "boom",
        deadLetteredAt: new Date(),
        releaseClaim: true,
      });
      const row2 = await db
        .selectFrom(TABLE)
        .select(["attempts", "lastError", "deadLetteredAt"])
        .where("id", "=", id2)
        .executeTakeFirstOrThrow();
      expect(row2.attempts).toBe(3);
      expect(row2.lastError).toBe("boom");
      expect(row2.deadLetteredAt).not.toBeNull();
    });
  });

  describe("OutboxWorkerBase.tick（実 DB round-trip）", () => {
    it("成功時に sentAt を set し claim を解放する", async () => {
      const id = await seed({ type: "T" });
      const worker = new OutboxWorkerBase(new KyselyOutboxDelegate(TABLE), [
        stubProcessor("T", ok(undefined)),
      ]);

      await worker.tick();

      const row = await db
        .selectFrom(TABLE)
        .select(["sentAt", "claimedAt"])
        .where("id", "=", id)
        .executeTakeFirstOrThrow();
      expect(row.sentAt).not.toBeNull();
      expect(row.claimedAt).toBeNull();
    });

    it("retriable 失敗時に attempts++ / nextRetryAt set / claim 解放（sentAt は null）", async () => {
      const id = await seed({ type: "T", attempts: 0 });
      const worker = new OutboxWorkerBase(
        new KyselyOutboxDelegate(TABLE),
        [stubProcessor("T", err({ message: "tmp", retriable: true }))],
        { baseBackoffSeconds: 30 }
      );

      await worker.tick();

      const row = await db
        .selectFrom(TABLE)
        .select(["sentAt", "attempts", "nextRetryAt", "claimedAt"])
        .where("id", "=", id)
        .executeTakeFirstOrThrow();
      expect(row.sentAt).toBeNull();
      expect(row.attempts).toBe(1);
      expect(row.nextRetryAt).not.toBeNull();
      expect(row.claimedAt).toBeNull();
    });

    it("未知種別は dead-letter 化する", async () => {
      const id = await seed({ type: "UNKNOWN" });
      const worker = new OutboxWorkerBase(new KyselyOutboxDelegate(TABLE), [
        stubProcessor("KNOWN", ok(undefined)),
      ]);

      await worker.tick();

      const row = await db
        .selectFrom(TABLE)
        .select(["deadLetteredAt", "sentAt", "claimedAt"])
        .where("id", "=", id)
        .executeTakeFirstOrThrow();
      expect(row.deadLetteredAt).not.toBeNull();
      expect(row.sentAt).toBeNull();
      expect(row.claimedAt).toBeNull();
    });
  });

  describe("KyselyOutboxQueryService", () => {
    it("status フィルタと件数を返す", async () => {
      await seed(); // pending (attempts 0)
      await seed({ attempts: 2 }); // retrying
      await seed({ deadLetteredAt: new Date() }); // dead-lettered
      await seed({ sentAt: new Date() }); // sent
      const qs = new KyselyOutboxQueryService();

      expect(
        (await qs.findMany("leaderApplication", { status: "pending", page: 1, perPage: 10 }))
          .totalCount
      ).toBe(1);
      expect(
        (await qs.findMany("leaderApplication", { status: "retrying", page: 1, perPage: 10 }))
          .totalCount
      ).toBe(1);
      expect(
        (await qs.findMany("leaderApplication", { status: "dead-lettered", page: 1, perPage: 10 }))
          .totalCount
      ).toBe(1);
      expect(
        (await qs.findMany("leaderApplication", { status: "sent", page: 1, perPage: 10 }))
          .totalCount
      ).toBe(1);
      expect(await qs.countIncomplete("leaderApplication")).toBe(3);
      expect(await qs.countByStatus("leaderApplication", "pending")).toBe(1);
    });
  });

  describe("KyselyOutboxCommandAdapter", () => {
    it("retry は dead-letter を解除し、complete は sentAt を set する（sent 済みは count 0）", async () => {
      const cmd = new KyselyOutboxCommandAdapter();

      const dead = await seed({
        deadLetteredAt: new Date(),
        nextRetryAt: new Date(),
        lastError: "e",
      });
      expect((await cmd.retry("leaderApplication", dead)).count).toBe(1);
      const retried = await db
        .selectFrom(TABLE)
        .select(["deadLetteredAt", "nextRetryAt", "lastError"])
        .where("id", "=", dead)
        .executeTakeFirstOrThrow();
      expect(retried.deadLetteredAt).toBeNull();
      expect(retried.nextRetryAt).toBeNull();
      expect(retried.lastError).toBeNull();

      const pending = await seed();
      expect((await cmd.complete("leaderApplication", pending)).count).toBe(1);
      const completed = await db
        .selectFrom(TABLE)
        .select("sentAt")
        .where("id", "=", pending)
        .executeTakeFirstOrThrow();
      expect(completed.sentAt).not.toBeNull();

      // 既に送信済みの行は更新されず count 0（TOCTOU 防止）
      const sent = await seed({ sentAt: new Date() });
      expect((await cmd.complete("leaderApplication", sent)).count).toBe(0);
    });
  });
});
