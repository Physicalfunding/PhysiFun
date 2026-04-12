import type { LeaderApplication } from "@physifun/domain";
import type {
  ApproveLeaderApplicationPort,
  AccountForApproval,
  AccountRole,
} from "@physifun/application";
import { prisma } from "../database/client";
import { reconstructLeaderApplication } from "./reconstructLeaderApplication";

/**
 * Prisma ベースの ApproveLeaderApplicationPort 実装
 *
 * 承認処理を単一トランザクションで実行する。
 */
export class PrismaApproveLeaderApplicationAdapter implements ApproveLeaderApplicationPort {
  async findApplicationById(id: string): Promise<LeaderApplication | null> {
    const row = await prisma.leaderApplication.findUnique({ where: { id } });
    if (!row) return null;
    return reconstructLeaderApplication(row);
  }

  async findAccountById(accountId: string): Promise<AccountForApproval | null> {
    const row = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, status: true, roles: true, email: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      status: row.status as AccountForApproval["status"],
      roles: row.roles as AccountRole[],
      email: row.email,
    };
  }

  async executeApproval(params: {
    application: LeaderApplication;
    accountId: string;
    newRoles: AccountRole[];
    reviewedAt: Date;
    outboxMessage: { id: string; type: string; payload: unknown };
  }): Promise<void> {
    await prisma.$transaction([
      prisma.leaderApplication.update({
        where: { id: params.application.id.toString() },
        data: {
          status: "APPROVED",
          reviewedAt: params.reviewedAt,
        },
      }),
      prisma.account.update({
        where: { id: params.accountId },
        data: { roles: { set: params.newRoles } },
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
