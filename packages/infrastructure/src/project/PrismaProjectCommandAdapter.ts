import type { Prisma, ReviewAction } from "@prisma/client";
import type { Project, ProjectReviewFeedback } from "@physifun/domain";
import {
  ProjectLimitExceededError,
  type CreateProjectOutboxMessageParams,
} from "@physifun/application";
import { prisma } from "../database/client";
import { reconstructProject } from "./reconstructProject";

// ==================== 型定義 ====================

/**
 * プロジェクト作成時に必要なアカウント情報
 *
 * application 層の AccountForProjectCreation と構造的に適合する。
 * 循環依存 (infrastructure → application) を避けるためここで定義する。
 */
export type AccountRole = "SUPPORTER" | "LEADER" | "ADMIN";

export interface AccountForProjectCreation {
  readonly id: string;
  readonly roles: AccountRole[];
}

// ==================== Prisma 実装 ====================

/**
 * Prisma ベースの Project コマンドアダプタ
 *
 * CreateProjectDraftPort と UpdateProjectDraftPort の両方を実装する。
 * 構造的部分型で Port インターフェースに適合する。
 */
export class PrismaProjectCommandAdapter {
  /**
   * アカウント ID でアカウントを検索する。
   * ロールを AccountRole 型にマッピングして返す。
   */
  async findAccountById(accountId: string): Promise<AccountForProjectCreation | null> {
    const row = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, roles: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      roles: row.roles as AccountRole[],
    };
  }

  /**
   * 件数チェック + プロジェクト保存をアトミックに実行する。
   *
   * 同一トランザクション内で件数チェックと INSERT を行い、
   * TOCTOU を防止する。上限超過時は ProjectLimitExceededError をスローする。
   */
  async countAndSaveProject(params: {
    project: Project;
    accountId: string;
    maxCount: number;
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const count = await tx.project.count({
        where: { ownerAccountId: params.accountId },
      });

      if (count >= params.maxCount) {
        throw new ProjectLimitExceededError();
      }

      const p = params.project;
      await tx.project.create({
        data: {
          id: p.id.toString(),
          ownerAccountId: params.accountId,
          title: p.title,
          coverImageUrl: p.coverImageUrl,
          category: p.category,
          prefectureCode: p.location?.prefectureCode ?? null,
          municipality: p.location?.municipality ?? null,
          phase: p.phase,
          status: p.publishStatus,
          summary: p.summary,
          story: p.body,
          leaderIntro: p.leaderIntroduction,
          snsLinks: p.snsLinks.isEmpty()
            ? {}
            : {
                x: p.snsLinks.x,
                instagram: p.snsLinks.instagram,
                facebook: p.snsLinks.facebook,
                website: p.snsLinks.website,
              },
          activityPlan: p.activityPlan,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        },
      });
    });
  }

  /**
   * プロジェクト ID で Project 集約を取得する。
   * Prisma 行データを reconstructProject で復元する。
   */
  async findProjectById(projectId: string): Promise<Project | null> {
    const row = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!row) return null;
    return reconstructProject(row);
  }

  /**
   * Project 集約の更新と ProjectOutboxMessage 書き込みを
   * 単一トランザクションで実行する。
   *
   * RequestPublishUseCase（公開申請: DRAFT → PENDING_REVIEW）が使用する。
   * 運営への公開申請通知タスクを Outbox に積み、後段ワーカーがメール配信する。
   */
  async executeInTransaction(params: {
    project: Project;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void> {
    const p = params.project;
    await prisma.$transaction([
      prisma.project.update({
        where: { id: p.id.toString() },
        data: {
          title: p.title,
          coverImageUrl: p.coverImageUrl,
          category: p.category,
          prefectureCode: p.location?.prefectureCode ?? null,
          municipality: p.location?.municipality ?? null,
          phase: p.phase,
          status: p.publishStatus,
          summary: p.summary,
          story: p.body,
          leaderIntro: p.leaderIntroduction,
          snsLinks: p.snsLinks.isEmpty()
            ? {}
            : {
                x: p.snsLinks.x,
                instagram: p.snsLinks.instagram,
                facebook: p.snsLinks.facebook,
                website: p.snsLinks.website,
              },
          activityPlan: p.activityPlan,
          updatedAt: p.updatedAt,
        },
      }),
      prisma.projectOutboxMessage.create({
        data: {
          id: params.outboxMessage.id,
          type: params.outboxMessage.type,
          payload: params.outboxMessage.payload as object,
        },
      }),
    ]);
  }

  /**
   * 運営差戻: Project 更新 + ProjectReviewFeedback 作成 + ProjectOutboxMessage 書き込みを
   * 単一トランザクションで実行する。
   *
   * RejectProjectPublicationUseCase（PENDING_REVIEW → DRAFT）が使用する。
   * リーダーへの差戻通知メール送信タスクを Outbox に積み、後段ワーカーが配信する。
   */
  async executeRejectInTransaction(params: {
   * 運営による強制非公開 (PUBLISHED → DRAFT) を 1 トランザクションで永続化する。
   *
   * ForceUnpublishProjectUseCase が使用する。
   *  1. Project.update (status=DRAFT, updatedAt=project.updatedAt)
   *  2. ProjectReviewFeedback.create (action=FORCE_UNPUBLISHED, note=理由)
   *  3. ProjectOutboxMessage.create (リーダーへの通知メール)
   */
  async executeForceUnpublishInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void> {
    const p = params.project;
    const fb = params.reviewFeedback;
    await prisma.$transaction([
      prisma.project.update({
        where: { id: p.id.toString() },
        data: {
          title: p.title,
          coverImageUrl: p.coverImageUrl,
          category: p.category,
          prefectureCode: p.location?.prefectureCode ?? null,
          municipality: p.location?.municipality ?? null,
          phase: p.phase,
          status: p.publishStatus,
          summary: p.summary,
          story: p.body,
          leaderIntro: p.leaderIntroduction,
          snsLinks: p.snsLinks.isEmpty()
            ? {}
            : {
                x: p.snsLinks.x,
                instagram: p.snsLinks.instagram,
                facebook: p.snsLinks.facebook,
                website: p.snsLinks.website,
              },
          activityPlan: p.activityPlan,
          updatedAt: p.updatedAt,
        },
      }),
      prisma.projectReviewFeedback.create({
        data: {
          id: fb.id.toString(),
          projectId: fb.projectId.toString(),
          reviewerId: fb.reviewerId.toString(),
          action: fb.action as ReviewAction,
          action: fb.action as import("@prisma/client").ReviewAction,
          note: fb.note,
          reviewedAt: fb.reviewedAt,
        },
      }),
      prisma.projectOutboxMessage.create({
        data: {
          id: params.outboxMessage.id,
          type: params.outboxMessage.type,
          payload: params.outboxMessage.payload as object,
        },
      }),
    ]);
  }

  /**
   * Project 集約と（任意の）審査フィードバックをアトミックに永続化する。
   *
   * 自動取下げ時は reviewFeedback が渡される。
   * 同一トランザクション内で両方を保存する。
   */
  async saveProjectWithOptionalFeedback(params: {
    project: Project;
    reviewFeedback?: ProjectReviewFeedback;
  }): Promise<void> {
    const p = params.project;

    const operations: Prisma.PrismaPromise<unknown>[] = [
      prisma.project.update({
        where: { id: p.id.toString() },
        data: {
          title: p.title,
          coverImageUrl: p.coverImageUrl,
          category: p.category,
          prefectureCode: p.location?.prefectureCode ?? null,
          municipality: p.location?.municipality ?? null,
          phase: p.phase,
          status: p.publishStatus,
          summary: p.summary,
          story: p.body,
          leaderIntro: p.leaderIntroduction,
          snsLinks: p.snsLinks.isEmpty()
            ? {}
            : {
                x: p.snsLinks.x,
                instagram: p.snsLinks.instagram,
                facebook: p.snsLinks.facebook,
                website: p.snsLinks.website,
              },
          activityPlan: p.activityPlan,
          updatedAt: p.updatedAt,
        },
      }),
    ];

    if (params.reviewFeedback) {
      const fb = params.reviewFeedback;
      operations.push(
        prisma.projectReviewFeedback.create({
          data: {
            id: fb.id.toString(),
            projectId: fb.projectId.toString(),
            reviewerId: fb.reviewerId.toString(),
            action: fb.action as ReviewAction,
            note: fb.note,
            reviewedAt: fb.reviewedAt,
          },
        })
      );
    }

    await prisma.$transaction(operations);
  }
}
