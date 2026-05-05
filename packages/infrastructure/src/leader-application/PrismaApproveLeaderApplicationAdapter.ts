import type { Prisma } from "@prisma/client";
import type { LeaderApplication, Project } from "@physifun/domain";
import { MaxProjectsReachedError } from "@physifun/application";
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
 * AdminAccount reviewer の最小情報
 *
 * application 層の AdminReviewer と構造的に適合する。
 */
export interface AdminReviewer {
  readonly id: string;
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

  /**
   * 応募者のアカウントを検索する。
   *
   * Issue #145 以降、reviewer は AdminAccount として別メソッド findAdminReviewerById で
   * 取得するため、このメソッドは応募者（APPLICANT）の lookup 専用となった。
   */
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

  /**
   * AdminAccount ID で reviewer を検索する。
   *
   * status !== "ACTIVE" の AdminAccount は null にマップする（呼び出し側は
   * 「未存在」と「無効化済み」を区別せず REVIEWER_NOT_FOUND として扱う）。
   */
  async findAdminReviewerById(id: string): Promise<AdminReviewer | null> {
    const row = await prisma.adminAccount.findUnique({
      where: { id },
      select: { id: true, email: true, status: true },
    });
    if (!row) return null;
    if (row.status !== "ACTIVE") return null;
    return { id: row.id, email: row.email };
  }

  async executeApproval(params: {
    application: LeaderApplication;
    accountId: string;
    newRoles: AccountRole[];
    reviewedAt: Date;
    /** Issue #192 PR5: 承認時に同時作成する初期 Project（DRAFT） */
    project: Project;
    /** リーダーあたりの Project 件数上限（同一トランザクション内で count チェック） */
    maxProjectsPerLeader: number;
    outboxMessage: { id: string; type: string; payload: unknown };
  }): Promise<void> {
    const p = params.project;
    // interactive transaction: 件数チェック + 4 操作をアトミックに実行（TOCTOU 防止）
    await prisma.$transaction(async (tx) => {
      // Project 件数上限チェック（同一 tx 内）
      const count = await tx.project.count({
        where: { ownerAccountId: params.accountId },
      });
      if (count >= params.maxProjectsPerLeader) {
        throw new MaxProjectsReachedError();
      }

      await tx.leaderApplication.update({
        where: { id: params.application.id.toString() },
        data: {
          status: "APPROVED",
          reviewedAt: params.reviewedAt,
        },
      });

      await tx.account.update({
        where: { id: params.accountId },
        data: { roles: { set: params.newRoles } },
      });

      // Issue #192 PR5: 応募内容から派生した初期 Project を DRAFT で同一トランザクションに INSERT
      await tx.project.create({
        data: {
          id: p.id.toString(),
          ownerAccountId: p.ownerAccountId.toString(),
          slug: null,
          title: p.title,
          summary: p.summary,
          story: p.body,
          leaderIntro: p.leaderIntroduction,
          coverImageUrl: p.coverImageUrl,
          category: p.category,
          prefectureCode: p.location?.prefectureCode ?? null,
          municipality: p.location?.municipality ?? null,
          snsLinks: p.snsLinks.isEmpty()
            ? {}
            : ({
                x: p.snsLinks.x,
                instagram: p.snsLinks.instagram,
                facebook: p.snsLinks.facebook,
                website: p.snsLinks.website,
              } satisfies Prisma.InputJsonValue),
          activityPlan: p.activityPlan,
          status: p.publishStatus,
          phase: p.phase,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        },
      });

      await tx.leaderApplicationOutboxMessage.create({
        data: {
          id: params.outboxMessage.id,
          type: params.outboxMessage.type,
          payload: params.outboxMessage.payload as Prisma.InputJsonValue,
        },
      });
    });
  }
}
