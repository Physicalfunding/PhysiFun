import type { LeaderApplication } from "@physifun/domain";
import { prisma } from "../database/client";
import { reconstructLeaderApplication } from "./reconstructLeaderApplication";

/**
 * 承認対象のアカウント情報
 *
 * application 層の ApproveLeaderApplicationPort.AccountForApproval と同一の型。
 * 循環依存 (infrastructure → application) を避けるためここで定義する。
 */
export type AccountRole = "SUPPORTER" | "LEADER";

export interface AccountForApproval {
  readonly id: string;
  readonly status: "PENDING_EMAIL_CONFIRMATION" | "ACTIVE" | "SUSPENDED";
  readonly roles: readonly AccountRole[];
  readonly email: string;
}

/**
 * Prisma ベースの ApproveLeaderApplicationPort 実装
 *
 * application 層の ApproveLeaderApplicationPort インターフェースに準拠。
 * 承認処理を単一トランザクションで実行する。
 *
 * NOTE: 循環依存 (infrastructure → application) を避けるため、
 * Port インターフェースを直接 import せず、構造的部分型で適合する。
 */
export class PrismaApproveLeaderApplicationAdapter {
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
