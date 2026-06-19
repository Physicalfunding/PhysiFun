import type { Updateable } from "kysely";
import { db } from "../database/kysely/client";
import type { OutboxMessagesTable } from "../database/kysely/types";
import type { OutboxDelegate, OutboxRow, OutboxUpdate } from "./OutboxWorkerBase";

/** Outbox 表名（leader-application / project の 2 ドメインで同一構造） */
export type OutboxTableName = "leader_application_outbox_messages" | "project_outbox_messages";

/**
 * Kysely ベースの Outbox デリゲート（#226）。
 *
 * 2 ドメインの Outbox 表は同一構造のため、表名をコンストラクタで受けて実装を共有する。
 * claim は `SELECT ... FOR UPDATE SKIP LOCKED` → `UPDATE ... RETURNING *` を単一トランザクション
 * で行う atomic claim。他ワーカーがロック中の行はスキップされるため二重 claim しない。
 */
export class KyselyOutboxDelegate implements OutboxDelegate {
  constructor(private readonly table: OutboxTableName) {}

  async claimBatch(params: {
    now: Date;
    claimExpiry: Date;
    claimToken: string;
    batchSize: number;
  }): Promise<OutboxRow[]> {
    const { now, claimExpiry, claimToken, batchSize } = params;
    const table = this.table;

    const rows = await db.transaction().execute(async (trx) => {
      const candidates = await trx
        .selectFrom(table)
        .select("id")
        .where("sentAt", "is", null)
        .where("deadLetteredAt", "is", null)
        .where((eb) => eb.or([eb("nextRetryAt", "is", null), eb("nextRetryAt", "<=", now)]))
        .where((eb) => eb.or([eb("claimedAt", "is", null), eb("claimedAt", "<", claimExpiry)]))
        .orderBy("createdAt", "asc")
        .limit(batchSize)
        .forUpdate()
        .skipLocked()
        .execute();

      if (candidates.length === 0) return [];

      const ids = candidates.map((c) => c.id);
      return trx
        .updateTable(table)
        .set({ claimedAt: now, claimedBy: claimToken })
        .where("id", "in", ids)
        .returningAll()
        .execute();
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
      attempts: row.attempts,
      lastError: row.lastError,
      nextRetryAt: row.nextRetryAt,
      deadLetteredAt: row.deadLetteredAt,
    }));
  }

  async update(id: string, patch: OutboxUpdate): Promise<void> {
    const set: Updateable<OutboxMessagesTable> = {};
    if (patch.sentAt !== undefined) set.sentAt = patch.sentAt;
    if (patch.attempts !== undefined) set.attempts = patch.attempts;
    if (patch.lastError !== undefined) set.lastError = patch.lastError;
    if (patch.nextRetryAt !== undefined) set.nextRetryAt = patch.nextRetryAt;
    if (patch.deadLetteredAt !== undefined) set.deadLetteredAt = patch.deadLetteredAt;
    if (patch.releaseClaim) {
      set.claimedAt = null;
      set.claimedBy = null;
    }
    if (Object.keys(set).length === 0) return;

    await db.updateTable(this.table).set(set).where("id", "=", id).execute();
  }
}
