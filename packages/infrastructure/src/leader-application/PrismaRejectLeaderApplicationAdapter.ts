import type { LeaderApplication } from "@physifun/domain";
import type { RejectLeaderApplicationPort } from "@physifun/application";
import { prisma } from "../database/client";
import { reconstructLeaderApplication } from "./reconstructLeaderApplication";

/**
 * Prisma ベースの RejectLeaderApplicationPort 実装
 *
 * 却下処理を単一トランザクションで実行する。
 */
export class PrismaRejectLeaderApplicationAdapter implements RejectLeaderApplicationPort {
  async findApplicationById(id: string): Promise<LeaderApplication | null> {
    const row = await prisma.leaderApplication.findUnique({ where: { id } });
    if (!row) return null;
    return reconstructLeaderApplication(row);
  }

  async executeRejectionInTransaction(params: {
    application: LeaderApplication;
    outboxMessage: { id: string; type: string; payload: unknown };
  }): Promise<void> {
    await prisma.$transaction([
      prisma.leaderApplication.update({
        where: { id: params.application.id.toString() },
        data: {
          status: "REJECTED",
          reviewerNote: params.application.reviewerNote,
          reviewedAt: params.application.reviewedAt,
        },
      }),
      prisma.leaderApplicationOutboxMessage.create({
        data: {
          id: params.outboxMessage.id,
          type: params.outboxMessage.type,
          payload: params.outboxMessage.payload as object,
        },
      }),
    ]);
  }
}
