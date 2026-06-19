import type { LeaderApplication, Project } from "@physifun/domain";
import { MaxProjectsReachedError } from "@physifun/application";
import type { Insertable } from "kysely";
import { db } from "../database/kysely/client";
import type { ProjectsTable, Role } from "../database/kysely/types";
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
 * Kysely ベースの ApproveLeaderApplicationPort 実装（Prisma 版からの移行 / #222）
 *
 * `PrismaApproveLeaderApplicationAdapter` と同一 API の drop-in。
 * 承認処理を単一トランザクション（interactive tx）で実行する。
 *
 * NOTE: 循環依存 (infrastructure → application) を避けるため、
 * Port インターフェースを直接 import せず、構造的部分型で適合する。
 */
export class KyselyApproveLeaderApplicationAdapter {
  async findApplicationById(id: string): Promise<LeaderApplication | null> {
    const row = await db
      .selectFrom("leader_applications")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
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
    const row = await db
      .selectFrom("accounts")
      .select(["id", "status", "roles", "email"])
      .where("id", "=", accountId)
      .executeTakeFirst();
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
    const row = await db
      .selectFrom("admin_accounts")
      .select(["id", "email", "status"])
      .where("id", "=", id)
      .executeTakeFirst();
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
    // interactive transaction: 件数チェック + 4 操作をアトミックに実行（TOCTOU 防止）
    await db.transaction().execute(async (trx) => {
      // Project 件数上限チェック（同一 tx 内）
      const countRow = await trx
        .selectFrom("projects")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("ownerAccountId", "=", params.accountId)
        .executeTakeFirstOrThrow();
      if (Number(countRow.count) >= params.maxProjectsPerLeader) {
        throw new MaxProjectsReachedError();
      }

      // LeaderApplication を APPROVED に更新（Prisma の @updatedAt 相当で updatedAt も更新）
      await trx
        .updateTable("leader_applications")
        .set({
          status: "APPROVED",
          reviewedAt: params.reviewedAt,
          updatedAt: params.reviewedAt,
        })
        .where("id", "=", params.application.id.toString())
        .execute();

      // Account.roles に LEADER を追加（重複承認時は UseCase 側で既存ロールのみが渡る）
      await trx
        .updateTable("accounts")
        .set({
          roles: [...params.newRoles] as Role[],
          updatedAt: params.reviewedAt,
        })
        .where("id", "=", params.accountId)
        .execute();

      // Issue #192 PR5: 応募内容から派生した初期 Project を DRAFT で同一トランザクションに INSERT
      await trx.insertInto("projects").values(toProjectInsert(params.project)).execute();

      await trx
        .insertInto("leader_application_outbox_messages")
        .values({
          id: params.outboxMessage.id,
          type: params.outboxMessage.type,
          payload: params.outboxMessage.payload,
        })
        .execute();
    });
  }
}

// ==================== マッピングヘルパー ====================

/** Project 集約 → projects INSERT 値（承認時の初期 Project 作成用） */
function toProjectInsert(p: Project): Insertable<ProjectsTable> {
  return {
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
    snsLinks: serializeSnsLinks(p),
    activityPlan: p.activityPlan,
    status: p.publishStatus,
    phase: p.phase,
    createdAt: p.createdAt,
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
