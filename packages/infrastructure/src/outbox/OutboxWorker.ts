import type { PrismaClient } from "@prisma/client";
import type { OutboxProcessor } from "./types";

/**
 * Outbox ワーカー。
 *
 * `tick()` を呼ぶと未送信メッセージをポーリングし、
 * 登録済みの OutboxProcessor にディスパッチする。
 *
 * 失敗時は attempts をインクリメントし、exponential backoff で nextRetryAt を設定する。
 */
export class OutboxWorker {
  private readonly processors: Map<string, OutboxProcessor>;

  /** 1 回の tick で処理する最大メッセージ数 */
  private readonly batchSize: number;

  /** backoff の基底秒数 (デフォルト 30 秒) */
  private readonly baseBackoffSeconds: number;

  constructor(
    private readonly prisma: PrismaClient,
    processors: OutboxProcessor[],
    options?: { batchSize?: number; baseBackoffSeconds?: number },
  ) {
    this.processors = new Map(processors.map((p) => [p.type, p]));
    this.batchSize = options?.batchSize ?? 20;
    this.baseBackoffSeconds = options?.baseBackoffSeconds ?? 30;
  }

  /**
   * 未送信メッセージを 1 バッチ分処理する。
   *
   * 送信条件:
   * - sentAt IS NULL
   * - nextRetryAt IS NULL OR nextRetryAt <= now
   */
  async tick(): Promise<void> {
    const now = new Date();

    const messages =
      await this.prisma.leaderApplicationOutboxMessage.findMany({
        where: {
          sentAt: null,
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        orderBy: { createdAt: "asc" },
        take: this.batchSize,
      });

    for (const msg of messages) {
      const processor = this.processors.get(msg.type);

      if (!processor) {
        // 未知のメッセージ種別 — lastError に記録して再試行しない
        await this.prisma.leaderApplicationOutboxMessage.update({
          where: { id: msg.id },
          data: {
            attempts: msg.attempts + 1,
            lastError: `未知のメッセージ種別: ${msg.type}`,
          },
        });
        continue;
      }

      const outboxMessage = {
        id: msg.id,
        type: msg.type,
        payload: msg.payload as Record<string, unknown>,
        createdAt: msg.createdAt,
        sentAt: msg.sentAt,
        attempts: msg.attempts,
        lastError: msg.lastError,
        nextRetryAt: msg.nextRetryAt,
      };

      const result = await processor.process(outboxMessage);

      if (result.ok) {
        // 成功: sentAt を記録
        await this.prisma.leaderApplicationOutboxMessage.update({
          where: { id: msg.id },
          data: { sentAt: new Date() },
        });
      } else {
        // 失敗: attempts インクリメント + backoff 計算
        const newAttempts = msg.attempts + 1;
        const nextRetryAt = result.error.retriable
          ? this.calculateNextRetry(newAttempts)
          : null; // retriable でない場合はリトライしない (dead-letter 扱い)

        await this.prisma.leaderApplicationOutboxMessage.update({
          where: { id: msg.id },
          data: {
            attempts: newAttempts,
            lastError: result.error.message,
            nextRetryAt,
          },
        });
      }
    }
  }

  /**
   * Exponential backoff で次回リトライ時刻を算出する。
   * delay = baseBackoffSeconds * 2^(attempts - 1) 秒
   */
  private calculateNextRetry(attempts: number): Date {
    const delaySeconds =
      this.baseBackoffSeconds * Math.pow(2, attempts - 1);
    return new Date(Date.now() + delaySeconds * 1000);
  }
}
