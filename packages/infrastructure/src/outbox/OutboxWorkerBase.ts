import type { OutboxProcessor } from "./types";

/**
 * Outbox メッセージの Prisma delegate インターフェース。
 *
 * Prisma の `leaderApplicationOutboxMessage` / `projectOutboxMessage` のように
 * `findMany` / `update` を提供するモデルを抽象化する。
 *
 * **NOTE**: `where` / `data` を `Record<string, unknown>` で受けるため、
 * Prisma 固有のクエリ構造 (OR, lte 等) の型安全性はコンパイル時に保証されない。
 * クエリ構造の変更時は `OutboxWorkerBase.tick()` 内の呼び出しを手動で確認すること。
 */
export interface OutboxDelegate {
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Record<string, string>;
    take: number;
  }): Promise<OutboxRow[]>;

  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
}

/** Prisma から取得した Outbox 行の共通型 */
export interface OutboxRow {
  id: string;
  type: string;
  payload: unknown;
  createdAt: Date;
  sentAt: Date | null;
  attempts: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  deadLetteredAt: Date | null;
}

/** リトライ回数の上限。超過したら dead-letter 扱い */
const DEFAULT_MAX_ATTEMPTS = 10;

export interface OutboxWorkerOptions {
  batchSize?: number;
  baseBackoffSeconds?: number;
  maxAttempts?: number;
}

/**
 * Outbox ワーカー基底クラス。
 *
 * `tick()` を呼ぶと未送信メッセージをポーリングし、
 * 登録済みの OutboxProcessor にディスパッチする。
 *
 * 失敗時は attempts をインクリメントし、exponential backoff で nextRetryAt を設定する。
 *
 * **NOTE**: 現在 claim/lock 機構はなく、並行実行時に同一メッセージを
 * 二重処理するリスクがある。単一ワーカーでの運用を前提とする。
 */
export class OutboxWorkerBase {
  private readonly processors: Map<string, OutboxProcessor>;
  private readonly batchSize: number;
  private readonly baseBackoffSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly delegate: OutboxDelegate,
    processors: OutboxProcessor[],
    options?: OutboxWorkerOptions
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
   * - deadLetteredAt IS NULL
   * - nextRetryAt IS NULL OR nextRetryAt <= now
   */
  async tick(): Promise<void> {
    const now = new Date();

    const messages = await this.delegate.findMany({
      where: {
        sentAt: null,
        deadLetteredAt: null,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: this.batchSize,
    });

    for (const msg of messages) {
      try {
        const processor = this.processors.get(msg.type);

        if (!processor) {
          // 未知のメッセージ種別 — dead-letter 化して再処理を防止
          await this.delegate.update({
            where: { id: msg.id },
            data: {
              attempts: { increment: 1 },
              lastError: `未知のメッセージ種別: ${msg.type}`,
              deadLetteredAt: new Date(),
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
          deadLetteredAt: msg.deadLetteredAt,
        };

        const result = await processor.process(outboxMessage);

        if (result.ok) {
          // 成功: sentAt を記録
          await this.delegate.update({
            where: { id: msg.id },
            data: { sentAt: new Date() },
          });
        } else {
          // 失敗: attempts インクリメント + backoff 計算
          const newAttempts = msg.attempts + 1;
          const isDeadLetter = !result.error.retriable || newAttempts >= this.maxAttempts;
          const nextRetryAt = isDeadLetter ? null : this.calculateNextRetry(newAttempts);

          await this.delegate.update({
            where: { id: msg.id },
            data: {
              attempts: { increment: 1 },
              lastError: result.error.message,
              nextRetryAt,
              ...(isDeadLetter ? { deadLetteredAt: new Date() } : {}),
            },
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const newAttempts = msg.attempts + 1;
        const isDeadLetter = newAttempts >= this.maxAttempts;
        const nextRetryAt = isDeadLetter ? null : this.calculateNextRetry(newAttempts);

        try {
          await this.delegate.update({
            where: { id: msg.id },
            data: {
              attempts: { increment: 1 },
              lastError: `unexpected: ${errorMessage}`,
              nextRetryAt,
              ...(isDeadLetter ? { deadLetteredAt: new Date() } : {}),
            },
          });
        } catch {
          // update 自体が失敗した場合は次 tick で再処理される
        }
      }
    }
  }

  /**
   * Exponential backoff で次回リトライ時刻を算出する。
   * delay = baseBackoffSeconds * 2^(attempts - 1) 秒
   */
  private calculateNextRetry(attempts: number): Date {
    const delaySeconds = this.baseBackoffSeconds * Math.pow(2, attempts - 1);
    return new Date(Date.now() + delaySeconds * 1000);
  }
}
