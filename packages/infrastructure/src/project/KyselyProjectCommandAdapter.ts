import type { Project, ProjectReviewFeedback } from "@physifun/domain";
import {
  OwnerPublishedLimitExceededError,
  ProjectLimitExceededError,
  type CreateProjectOutboxMessageParams,
  type ApproveProjectPublicationPort,
  type RejectProjectPublicationPort,
  type ForceUnpublishProjectPort,
} from "@physifun/application";
import type { Insertable, Updateable, Transaction } from "kysely";
import { db } from "../database/kysely/client";
import type { DB, ProjectsTable, ProjectReviewFeedbacksTable } from "../database/kysely/types";
import { reconstructProject } from "./reconstructProject";

// ==================== 型定義（Prisma 版と構造的に一致させる） ====================

export type AccountRole = "SUPPORTER" | "LEADER";

export interface AccountForProjectCreation {
  readonly id: string;
  readonly roles: AccountRole[];
}

export interface AdminReviewer {
  readonly id: string;
  readonly email: string;
}

// ==================== Kysely 実装 ====================

/**
 * Kysely ベースの Project コマンドアダプタ（PoC: Prisma 版からの移行）
 *
 * `PrismaProjectCommandAdapter` と同一の公開メソッドを提供する drop-in 実装。
 * トランザクションは `db.transaction().execute(cb)` を用い、コールバック内の
 * throw でロールバックされる（TOCTOU 対策の count→insert/update を同一 tx で実施）。
 */
export class KyselyProjectCommandAdapter
  implements ApproveProjectPublicationPort, RejectProjectPublicationPort, ForceUnpublishProjectPort
{
  /** アカウント ID でアカウントを検索し、ロールを返す（LEADER ロール検証用） */
  async findAccountById(accountId: string): Promise<AccountForProjectCreation | null> {
    const row = await db
      .selectFrom("accounts")
      .select(["id", "roles"])
      .where("id", "=", accountId)
      .executeTakeFirst();
    if (!row) return null;
    return { id: row.id, roles: row.roles as AccountRole[] };
  }

  /**
   * AdminAccount ID で reviewer を検索する。
   * status !== "ACTIVE" は null にマップする（呼び出し側は未存在と無効化済みを区別しない）。
   */
  async findAdminReviewerById(id: string): Promise<AdminReviewer | null> {
    const row = await db
      .selectFrom("admin_accounts")
      .select(["id", "email", "status"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    if (row.status !== "ACTIVE") return null;
    return { id: row.id, email: row.email };
  }

  /**
   * 件数チェック + プロジェクト保存をアトミックに実行する。
   * 同一トランザクション内で count → INSERT を行い TOCTOU を防止する。
   */
  async countAndSaveProject(params: {
    project: Project;
    accountId: string;
    maxCount: number;
  }): Promise<void> {
    await db.transaction().execute(async (trx) => {
      const countRow = await trx
        .selectFrom("projects")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("ownerAccountId", "=", params.accountId)
        .executeTakeFirstOrThrow();

      if (Number(countRow.count) >= params.maxCount) {
        throw new ProjectLimitExceededError();
      }

      await trx
        .insertInto("projects")
        .values(toProjectInsert(params.project, params.accountId))
        .execute();
    });
  }

  /** プロジェクト ID で Project 集約を取得する */
  async findProjectById(projectId: string): Promise<Project | null> {
    const row = await db
      .selectFrom("projects")
      .selectAll()
      .where("id", "=", projectId)
      .executeTakeFirst();
    if (!row) return null;
    return reconstructProject(row);
  }

  /**
   * Project 更新 + ProjectOutboxMessage 書き込みを単一トランザクションで実行する。
   * RequestPublishUseCase（DRAFT → PENDING_REVIEW）が使用する。
   */
  async executeInTransaction(params: {
    project: Project;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void> {
    await db.transaction().execute(async (trx) => {
      await updateProject(trx, params.project);
      await insertProjectOutbox(trx, params.outboxMessage);
    });
  }

  /**
   * 運営差戻: Project 更新 + ProjectReviewFeedback 作成 + Outbox 書き込み。
   * RejectProjectPublicationUseCase（PENDING_REVIEW → DRAFT）が使用する。
   */
  async executeRejectInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void> {
    await db.transaction().execute(async (trx) => {
      await updateProject(trx, params.project);
      await insertReviewFeedback(trx, params.reviewFeedback);
      await insertProjectOutbox(trx, params.outboxMessage);
    });
  }

  /**
   * 運営による強制非公開（PUBLISHED → DRAFT）を 1 トランザクションで永続化する。
   */
  async executeForceUnpublishInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void> {
    await db.transaction().execute(async (trx) => {
      await updateProject(trx, params.project);
      await insertReviewFeedback(trx, params.reviewFeedback);
      await insertProjectOutbox(trx, params.outboxMessage);
    });
  }

  /**
   * Project 集約と（任意の）審査フィードバックをアトミックに永続化する。
   * 自動取下げ時は reviewFeedback が渡される。
   */
  async saveProjectWithOptionalFeedback(params: {
    project: Project;
    reviewFeedback?: ProjectReviewFeedback;
  }): Promise<void> {
    await db.transaction().execute(async (trx) => {
      await updateProject(trx, params.project);
      if (params.reviewFeedback) {
        await insertReviewFeedback(trx, params.reviewFeedback);
      }
    });
  }

  /**
   * プロジェクト公開承認をアトミックに実行する。
   * ApproveProjectPublicationUseCase（PENDING_REVIEW → PUBLISHED）が使用する。
   *
   * interactive transaction 内で
   *  - 同一オーナーの PUBLISHED 件数を count し上限チェック（Case A、TOCTOU 解消）
   *  - Project.status / publishedAt / updatedAt を最小更新
   *  - ProjectReviewFeedback (APPROVED) を作成
   *  - ProjectOutboxMessage (承認通知メール) を作成
   * をまとめて永続化する。
   */
  async executeApproveInTransaction(params: {
    project: Project;
    reviewFeedback: ProjectReviewFeedback;
    outboxMessage: CreateProjectOutboxMessageParams;
    publishedAt: Date;
    maxPublishedPerOwner: number;
  }): Promise<void> {
    const p = params.project;

    await db.transaction().execute(async (trx) => {
      // Case A: 同一オーナーの PUBLISHED 件数チェック（同一 tx 内で TOCTOU 解消）
      const countRow = await trx
        .selectFrom("projects")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("ownerAccountId", "=", p.ownerAccountId.toString())
        .where("status", "=", "PUBLISHED")
        .executeTakeFirstOrThrow();

      if (Number(countRow.count) >= params.maxPublishedPerOwner) {
        throw new OwnerPublishedLimitExceededError();
      }

      // Project の最小更新: status / publishedAt / updatedAt のみ
      await trx
        .updateTable("projects")
        .set({
          status: p.publishStatus,
          publishedAt: params.publishedAt,
          updatedAt: p.updatedAt,
        })
        .where("id", "=", p.id.toString())
        .execute();

      await insertReviewFeedback(trx, params.reviewFeedback);
      await insertProjectOutbox(trx, params.outboxMessage);
    });
  }
}

// ==================== マッピングヘルパー ====================

/** Project 集約 → projects INSERT 値（全フィールド） */
function toProjectInsert(p: Project, accountId: string): Insertable<ProjectsTable> {
  return {
    id: p.id.toString(),
    ownerAccountId: accountId,
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
    snsLinks: serializeSnsLinks(p),
    activityPlan: p.activityPlan,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Project 集約 → projects UPDATE 値（id/ownerAccountId/createdAt は更新しない） */
function toProjectUpdate(p: Project): Updateable<ProjectsTable> {
  return {
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
    snsLinks: serializeSnsLinks(p),
    activityPlan: p.activityPlan,
    updatedAt: p.updatedAt,
  };
}

/** snsLinks 値オブジェクト → jsonb 格納値（空なら {}、Prisma 版と同一挙動） */
function serializeSnsLinks(p: Project): Record<string, unknown> {
  return p.snsLinks.isEmpty()
    ? {}
    : {
        x: p.snsLinks.x,
        instagram: p.snsLinks.instagram,
        facebook: p.snsLinks.facebook,
        website: p.snsLinks.website,
      };
}

function toFeedbackInsert(fb: ProjectReviewFeedback): Insertable<ProjectReviewFeedbacksTable> {
  return {
    id: fb.id.toString(),
    projectId: fb.projectId.toString(),
    reviewerId: fb.reviewerId.toString(),
    action: fb.action,
    note: fb.note,
    reviewedAt: fb.reviewedAt,
  };
}

function updateProject(trx: Transaction<DB>, project: Project): Promise<unknown> {
  return trx
    .updateTable("projects")
    .set(toProjectUpdate(project))
    .where("id", "=", project.id.toString())
    .execute();
}

function insertReviewFeedback(
  trx: Transaction<DB>,
  feedback: ProjectReviewFeedback
): Promise<unknown> {
  return trx.insertInto("project_review_feedbacks").values(toFeedbackInsert(feedback)).execute();
}

function insertProjectOutbox(
  trx: Transaction<DB>,
  message: CreateProjectOutboxMessageParams
): Promise<unknown> {
  return trx
    .insertInto("project_outbox_messages")
    .values({ id: message.id, type: message.type, payload: message.payload })
    .execute();
}
