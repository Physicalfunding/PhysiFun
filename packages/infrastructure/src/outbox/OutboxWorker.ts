import type { PrismaClient } from "@prisma/client";
import type { OutboxProcessor } from "./types";
import { OutboxWorkerBase, type OutboxWorkerOptions } from "./OutboxWorkerBase";

/**
 * LeaderApplication 用 Outbox ワーカー。
 *
 * `prisma.leaderApplicationOutboxMessage` を delegate として
 * 共通の OutboxWorkerBase に処理を委譲する。
 */
export class OutboxWorker {
  private readonly base: OutboxWorkerBase;

  constructor(prisma: PrismaClient, processors: OutboxProcessor[], options?: OutboxWorkerOptions) {
    this.base = new OutboxWorkerBase(
      prisma.leaderApplicationOutboxMessage as any,
      processors,
      options
    );
  }

  async tick(): Promise<void> {
    return this.base.tick();
  }
}
