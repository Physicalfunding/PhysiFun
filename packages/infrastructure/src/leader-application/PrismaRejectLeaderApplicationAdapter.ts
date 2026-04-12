import type { LeaderApplication } from "@physifun/domain";
import { prisma } from "../database/client";
import { reconstructLeaderApplication } from "./reconstructLeaderApplication";

/**
 * Prisma ベースの RejectLeaderApplicationPort 実装
 *
 * application 層の RejectLeaderApplicationPort インターフェースに準拠。
 * 却下処理を単一トランザクションで実行する。
 *
 * NOTE: 循環依存 (infrastructure → application) を避けるため、
 * Port インターフェースを直接 import せず、構造的部分型で適合する。
 */
export class PrismaRejectLeaderApplicationAdapter {
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
