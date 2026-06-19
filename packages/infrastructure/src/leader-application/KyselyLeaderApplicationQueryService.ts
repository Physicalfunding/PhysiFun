import {
  isLeaderApplicationRecruitmentType,
  isProjectPhase,
  type LeaderApplicationStatus,
  ProjectPhase,
} from "@physifun/domain";
import { db } from "../database/kysely/client";
import type {
  LeaderApplicationQueryService,
  LeaderApplicationDetail,
  LeaderApplicationListResult,
} from "./PrismaLeaderApplicationQueryService";

// DTO / IF 型は既存の Prisma 実装と共通のものを再利用する（移行期間中）。
// Prisma 実装を撤去する際にこれらの型を中立なモジュールへ移動する。
export type {
  LeaderApplicationQueryService,
  LeaderApplicationListItem,
  LeaderApplicationListResult,
  LeaderApplicationDetail,
} from "./PrismaLeaderApplicationQueryService";

/**
 * Kysely ベースの LeaderApplication Query Service（Prisma 版からの移行 / #222）
 *
 * `PrismaLeaderApplicationQueryService` と同一の公開メソッド・戻り値を提供する drop-in 実装。
 * CQRS の Q 側として、ドメインエンティティを経由せず DB 行から直接 DTO へマップする。
 */
export class KyselyLeaderApplicationQueryService implements LeaderApplicationQueryService {
  async findMany(params: {
    status?: LeaderApplicationStatus;
    page: number;
    perPage: number;
  }): Promise<LeaderApplicationListResult> {
    const offset = (params.page - 1) * params.perPage;

    let listQuery = db
      .selectFrom("leader_applications")
      .innerJoin("accounts", "accounts.id", "leader_applications.accountId")
      .select([
        "leader_applications.id",
        "leader_applications.accountId",
        "leader_applications.projectTitle",
        "leader_applications.status",
        "leader_applications.submittedAt",
        "leader_applications.reviewedAt",
        "accounts.displayName as displayName",
        "accounts.email as email",
      ]);

    let countQuery = db
      .selectFrom("leader_applications")
      .select((eb) => eb.fn.countAll<string>().as("count"));

    if (params.status) {
      listQuery = listQuery.where("leader_applications.status", "=", params.status);
      countQuery = countQuery.where("status", "=", params.status);
    }

    const [items, countRow] = await Promise.all([
      listQuery
        .orderBy("leader_applications.submittedAt", "desc")
        .limit(params.perPage)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    return {
      items: items.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        displayName: row.displayName,
        email: row.email,
        projectTitle: row.projectTitle,
        status: row.status,
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt,
      })),
      totalCount: Number(countRow.count),
    };
  }

  async findById(id: string): Promise<LeaderApplicationDetail | null> {
    const row = await db
      .selectFrom("leader_applications")
      .innerJoin("accounts", "accounts.id", "leader_applications.accountId")
      .select([
        "leader_applications.id",
        "leader_applications.accountId",
        "leader_applications.status",
        "leader_applications.reviewerNote",
        "leader_applications.projectTitle",
        "leader_applications.projectSummary",
        "leader_applications.projectStory",
        "leader_applications.projectCategory",
        "leader_applications.prefectureCode",
        "leader_applications.municipality",
        "leader_applications.activityContent",
        "leader_applications.snsLinks",
        "leader_applications.phoneNumber",
        "leader_applications.progress",
        "leader_applications.recruitmentTypes",
        "leader_applications.eventLocation",
        "leader_applications.eventPeriod",
        "leader_applications.recruitCount",
        "leader_applications.skillItemNeeds",
        "leader_applications.skillItemDeadline",
        "leader_applications.timeReturn",
        "leader_applications.skillItemReturn",
        "leader_applications.experienceOffered",
        "leader_applications.submittedAt",
        "leader_applications.reviewedAt",
        "accounts.displayName as displayName",
        "accounts.email as email",
      ])
      .where("leader_applications.id", "=", id)
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      accountId: row.accountId,
      displayName: row.displayName,
      email: row.email,
      status: row.status,
      reviewerNote: row.reviewerNote,
      projectTitle: row.projectTitle,
      projectSummary: row.projectSummary,
      projectStory: row.projectStory,
      projectCategory: row.projectCategory,
      prefectureCode: row.prefectureCode,
      municipality: row.municipality,
      activityContent: row.activityContent,
      snsLinks: row.snsLinks as LeaderApplicationDetail["snsLinks"],
      phoneNumber: row.phoneNumber,
      // Prisma 版と同じく、永続化層の値はドメインの型ガードで安全に絞り込む。
      // 不正値（既知 enum 外）は PLANNING にフォールバックする。
      progress: isProjectPhase(row.progress) ? row.progress : ProjectPhase.PLANNING,
      // 不正値（既知 enum 外）は黙って除外する防御的フィルタ（Prisma 版と同一）。
      recruitmentTypes: row.recruitmentTypes.filter(isLeaderApplicationRecruitmentType),
      eventLocation: row.eventLocation,
      eventPeriod: row.eventPeriod,
      recruitCount: row.recruitCount,
      skillItemNeeds: row.skillItemNeeds,
      skillItemDeadline: row.skillItemDeadline,
      timeReturn: row.timeReturn,
      skillItemReturn: row.skillItemReturn,
      experienceOffered: row.experienceOffered,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
    };
  }

  async countByStatus(status: LeaderApplicationStatus): Promise<number> {
    const row = await db
      .selectFrom("leader_applications")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("status", "=", status)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
}
