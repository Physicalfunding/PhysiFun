import type { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../database/client";

/**
 * SubmitLeaderApplicationPort で用いるアカウントの最小表現
 *
 * application 層の AccountRow と同一構造。循環依存回避のためここで再定義する。
 */
export interface AccountRow {
  readonly id: string;
  readonly email: string;
  readonly status: "PENDING_EMAIL_CONFIRMATION" | "ACTIVE";
}

/**
 * SubmitLeaderApplicationUseCase のトランザクション内で作成する
 * Account / LeaderApplication / LeaderApplicationOutboxMessage のパラメータ型
 */
interface CreateAccountParams {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: "PENDING_EMAIL_CONFIRMATION" | "ACTIVE";
  readonly roles: readonly ("SUPPORTER" | "LEADER" | "ADMIN")[];
  readonly activationToken: string;
  readonly activationTokenExp: Date;
}

interface CreateLeaderApplicationParams {
  readonly id: string;
  readonly accountId: string;
  readonly status: "PENDING";
  readonly projectTitle: string;
  readonly projectSummary: string;
  readonly projectStory: string;
  readonly projectCategory: string;
  readonly prefectureCode: string;
  readonly municipality: string | null;
  readonly plannedActivities: string;
  readonly snsLinks: {
    x: string | null;
    instagram: string | null;
    facebook: string | null;
    website: string | null;
  } | null;
  readonly submittedAt: Date;
}

interface CreateOutboxMessageParams {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
}

/**
 * Prisma ベースの SubmitLeaderApplicationPort 実装
 *
 * application 層の SubmitLeaderApplicationPort インターフェースに構造的部分型で適合する。
 * findAccountByEmail / executeInTransaction の 2 メソッドを提供。
 *
 * executeInTransaction は Account + LeaderApplication + LeaderApplicationOutboxMessage を
 * 単一トランザクションで INSERT する。既存の PrismaApproveLeaderApplicationAdapter と
 * 同様に batched transaction (`$transaction([...])`) を使用する。
 *
 * NOTE: 循環依存 (infrastructure → application) を避けるため、
 * Port インターフェースを直接 import せず、構造的部分型で適合する。
 */
export class PrismaSubmitLeaderApplicationAdapter {
  async findAccountByEmail(email: string): Promise<AccountRow | null> {
    const row = await prisma.account.findUnique({
      where: { email },
      select: { id: true, email: true, status: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      status: row.status as AccountRow["status"],
    };
  }

  async executeInTransaction(params: {
    account: CreateAccountParams;
    leaderApplication: CreateLeaderApplicationParams;
    outboxMessage: CreateOutboxMessageParams;
  }): Promise<void> {
    const { account, leaderApplication, outboxMessage } = params;

    await prisma.$transaction([
      prisma.account.create({
        data: {
          id: account.id,
          email: account.email,
          displayName: account.displayName,
          status: account.status,
          roles: { set: account.roles as Role[] },
          activationToken: account.activationToken,
          activationTokenExp: account.activationTokenExp,
        },
      }),
      prisma.leaderApplication.create({
        data: {
          id: leaderApplication.id,
          accountId: leaderApplication.accountId,
          status: leaderApplication.status,
          projectTitle: leaderApplication.projectTitle,
          projectSummary: leaderApplication.projectSummary,
          projectStory: leaderApplication.projectStory,
          projectCategory: leaderApplication.projectCategory,
          prefectureCode: leaderApplication.prefectureCode,
          municipality: leaderApplication.municipality,
          plannedActivities: leaderApplication.plannedActivities,
          snsLinks:
            leaderApplication.snsLinks === null
              ? Prisma.JsonNull
              : (leaderApplication.snsLinks as Prisma.InputJsonValue),
          submittedAt: leaderApplication.submittedAt,
        },
      }),
      prisma.leaderApplicationOutboxMessage.create({
        data: {
          id: outboxMessage.id,
          type: outboxMessage.type,
          payload: outboxMessage.payload as Prisma.InputJsonValue,
        },
      }),
    ]);
  }
}
