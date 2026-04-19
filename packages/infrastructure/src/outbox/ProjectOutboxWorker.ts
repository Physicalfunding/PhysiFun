import type { PrismaClient } from "@prisma/client";
import type { OutboxProcessor } from "./types";
import { OutboxWorkerBase, type OutboxWorkerOptions } from "./OutboxWorkerBase";

/**
 * Project 用 Outbox ワーカー。
 *
 * `prisma.projectOutboxMessage` を delegate として
 * 共通の OutboxWorkerBase に処理を委譲する。
 */
export class ProjectOutboxWorker {
  private readonly base: OutboxWorkerBase;

  constructor(prisma: PrismaClient, processors: OutboxProcessor[], options?: OutboxWorkerOptions) {
    this.base = new OutboxWorkerBase(prisma.projectOutboxMessage as any, processors, options);
  }

  async tick(): Promise<void> {
    return this.base.tick();
  }
}
