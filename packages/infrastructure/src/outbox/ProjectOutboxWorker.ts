import type { PrismaClient } from "@prisma/client";
import type { OutboxProcessor } from "./types";

/**
 * Project 用 Outbox ワーカー。
 *
 * `tick()` を呼ぶと `project_outbox_messages` の未送信メッセージをポーリングし、
 * 登録済みの OutboxProcessor にディスパッチする。
 *
 * 失敗時は attempts をインクリメントし、exponential backoff で nextRetryAt を設定する。
 */

/** リトライ回数の上限。超過したら dead-letter 扱い */
const DEFAULT_MAX_ATTEMPTS = 10;

export class ProjectOutboxWorker {
  private readonly processors: Map<string, OutboxProcessor>;
  private readonly batchSize: number;
  private readonly baseBackoffSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaClient,
    processors: OutboxProcessor[],
    options?: {
      batchSize?: number;
      baseBackoffSeconds?: number;
      maxAttempts?: number;
    }
  ) {
    this.processors = new Map(processors.map((p) => [p.type, p]));
    this.batchSize = options?.batchSize ?? 20;
    this.baseBackoffSeconds = options?.baseBackoffSeconds ?? 30;
    this.maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
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

    const messages = await this.prisma.projectOutboxMessage.findMany({
      where: {
        sentAt: null,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: this.batchSize,
    });

    for (const msg of messages) {
      try {
        const processor = this.processors.get(msg.type);

        if (!processor) {
          await this.prisma.projectOutboxMessage.update({
            where: { id: msg.id },
            data: {
              attempts: { increment: 1 },
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
          await this.prisma.projectOutboxMessage.update({
            where: { id: msg.id },
            data: { sentAt: new Date() },
          });
        } else {
          const newAttempts = msg.attempts + 1;
          const nextRetryAt =
            result.error.retriable && newAttempts < this.maxAttempts
              ? this.calculateNextRetry(newAttempts)
              : null;

          await this.prisma.projectOutboxMessage.update({
            where: { id: msg.id },
            data: {
              attempts: { increment: 1 },
              lastError: result.error.message,
              nextRetryAt,
            },
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        try {
          await this.prisma.projectOutboxMessage.update({
            where: { id: msg.id },
            data: {
              attempts: { increment: 1 },
              lastError: `unexpected: ${errorMessage}`,
            },
          });
        } catch {
          // update 自体が失敗した場合は次 tick で再処理される
        }
      }
    }
  }

  private calculateNextRetry(attempts: number): Date {
    const delaySeconds = this.baseBackoffSeconds * Math.pow(2, attempts - 1);
    return new Date(Date.now() + delaySeconds * 1000);
  }
}
