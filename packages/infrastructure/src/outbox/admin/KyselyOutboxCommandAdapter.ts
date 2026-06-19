import { db } from "../../database/kysely/client";
import type { OutboxSource } from "./PrismaOutboxQueryService";

type OutboxTableName = "leader_application_outbox_messages" | "project_outbox_messages";

function tableFor(source: OutboxSource): OutboxTableName {
  return source === "leaderApplication"
    ? "leader_application_outbox_messages"
    : "project_outbox_messages";
}

/**
 * Outbox メッセージの手動操作アダプタ（運営管理用。Prisma 版からの移行 / #226）。
 *
 * `PrismaOutboxCommandAdapter` と同一 API の drop-in。
 */
export class KyselyOutboxCommandAdapter {
  /**
   * 手動リトライ: deadLetteredAt / nextRetryAt / lastError をクリアしてワーカー再処理対象に戻す。
   * attempts は意図的にリセットしない（監査証跡として保持）。
   * sentAt 設定済みの場合は更新せず count: 0（TOCTOU 防止）。
   */
  async retry(source: OutboxSource, id: string): Promise<{ count: number }> {
    const result = await db
      .updateTable(tableFor(source))
      .set({ deadLetteredAt: null, nextRetryAt: null, lastError: null })
      .where("id", "=", id)
      .where("sentAt", "is", null)
      .executeTakeFirst();
    return { count: result ? Number(result.numUpdatedRows) : 0 };
  }

  /**
   * 手動完了マーク: sentAt を設定して処理済みにする。
   * sentAt 設定済みの場合は更新せず count: 0（TOCTOU 防止）。
   */
  async complete(source: OutboxSource, id: string): Promise<{ count: number }> {
    const result = await db
      .updateTable(tableFor(source))
      .set({ sentAt: new Date() })
      .where("id", "=", id)
      .where("sentAt", "is", null)
      .executeTakeFirst();
    return { count: result ? Number(result.numUpdatedRows) : 0 };
  }
}
