import { prisma } from "../../database/client";
import type { OutboxSource } from "./PrismaOutboxQueryService";

/**
 * Outbox メッセージの手動操作アダプタ（運営管理用）
 */
export class PrismaOutboxCommandAdapter {
  /**
   * 手動リトライ: deadLetteredAt / nextRetryAt / lastError をクリアしてワーカー再処理対象に戻す。
   * attempts は意図的にリセットしない（監査証跡として保持し、過去の試行回数を確認可能にする）。
   *
   * sentAt が既に設定済みの場合は更新せず count: 0 を返す（TOCTOU 防止）。
   */
  async retry(source: OutboxSource, id: string): Promise<{ count: number }> {
    const where = { id, sentAt: null };
    const data = {
      deadLetteredAt: null,
      nextRetryAt: null,
      lastError: null,
    };
    if (source === "leaderApplication") {
      return prisma.leaderApplicationOutboxMessage.updateMany({ where, data });
    }
    return prisma.projectOutboxMessage.updateMany({ where, data });
  }

  /**
   * 手動完了マーク: sentAt を設定して処理済みにする。
   *
   * sentAt が既に設定済みの場合は更新せず count: 0 を返す（TOCTOU 防止）。
   */
  async complete(source: OutboxSource, id: string): Promise<{ count: number }> {
    const where = { id, sentAt: null };
    const data = { sentAt: new Date() };
    if (source === "leaderApplication") {
      return prisma.leaderApplicationOutboxMessage.updateMany({ where, data });
    }
    return prisma.projectOutboxMessage.updateMany({ where, data });
  }
}
