import {
  isLeaderApplicationRecruitmentType,
  isProjectPhase,
  type LeaderApplicationStatus,
  ProjectPhase,
} from "@physifun/domain";
import type {
  MyLeaderApplicationQueryPort,
  MyLeaderApplicationStatusDTO,
} from "@physifun/application";
import { db } from "../database/kysely/client";
import { parsePgEnumArray } from "../database/kysely/pgArray";
import type {
  LeaderApplicationQueryService,
  LeaderApplicationDetail,
  LeaderApplicationListResult,
} from "./leaderApplicationQueryTypes";

// DTO / IF 型は `leaderApplicationQueryTypes.ts` に定義。既存 import 互換のため再 export する。
export type {
  LeaderApplicationQueryService,
  LeaderApplicationListItem,
  LeaderApplicationListResult,
  LeaderApplicationDetail,
} from "./leaderApplicationQueryTypes";

/**
 * Kysely ベースの LeaderApplication Query Service（Prisma 版からの移行 / #222）
 *
 * 運営向け（`LeaderApplicationQueryService`。旧 Prisma 版と同一 API）と、
 * 応募者本人向け（`MyLeaderApplicationQueryPort`。#373）の両方を実装する。
 * CQRS の Q 側として、ドメインエンティティを経由せず DB 行から直接 DTO へマップする。
 */
export class KyselyLeaderApplicationQueryService
  implements LeaderApplicationQueryService, MyLeaderApplicationQueryPort
{
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
      // pg はネイティブ enum 配列を文字列で返すため parsePgEnumArray で配列化したうえで、
      // 不正値（既知 enum 外）は黙って除外する防御的フィルタを掛ける（Prisma 版と同一）。
      recruitmentTypes: parsePgEnumArray(row.recruitmentTypes).filter(
        isLeaderApplicationRecruitmentType
      ),
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

  /**
   * 本人のロール・メールアドレスと、最新の応募を読む（#373）。
   *
   * 本人以外の応募を返さないよう、アカウントも応募も引数の accountId だけで絞る。
   * 応募は再応募で複数ありうるので、`submittedAt` が一番新しいものを返す
   * （同じ時刻なら id で並べて、結果を毎回同じにする）。
   * アカウントと応募は 1 本の SQL（LEFT JOIN LATERAL）で同じ時点のものを読む。
   * 承認（応募の APPROVED 化と LEADER の付与は 1 トランザクション）と重なっても、
   * 「リーダーではないのに最新の応募が APPROVED」のような食い違いを返さないため。
   */
  async findStatusByAccountId(accountId: string): Promise<MyLeaderApplicationStatusDTO | null> {
    const row = await db
      .selectFrom("accounts")
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom("leader_applications")
            // 外側の accounts と同じ名前の列（id・status）があるので、列はテーブル名付きで書く
            .select([
              "leader_applications.id",
              "leader_applications.status",
              "leader_applications.projectTitle",
              "leader_applications.projectSummary",
              "leader_applications.projectCategory",
              "leader_applications.submittedAt",
              "leader_applications.reviewerNote",
            ])
            .whereRef("leader_applications.accountId", "=", "accounts.id")
            .orderBy("leader_applications.submittedAt", "desc")
            .orderBy("leader_applications.id", "desc")
            .limit(1)
            .as("latest"),
        (join) => join.onTrue()
      )
      .select([
        "accounts.email",
        "accounts.roles",
        "latest.id as applicationId",
        "latest.status",
        "latest.projectTitle",
        "latest.projectSummary",
        "latest.projectCategory",
        "latest.submittedAt",
        "latest.reviewerNote",
      ])
      .where("accounts.id", "=", accountId)
      .executeTakeFirst();

    if (!row) return null;

    return {
      // pg はネイティブ enum 配列（roles）を文字列で返すため配列化する。
      isLeader: parsePgEnumArray(row.roles).includes("LEADER"),
      email: row.email,
      // LEFT JOIN なので、応募が無いと応募の列はすべて NULL になる（応募の NOT NULL 列で判定する）
      latestApplication:
        row.applicationId !== null &&
        row.status !== null &&
        row.projectTitle !== null &&
        row.projectSummary !== null &&
        row.projectCategory !== null &&
        row.submittedAt !== null
          ? {
              id: row.applicationId,
              status: row.status,
              projectTitle: row.projectTitle,
              projectSummary: row.projectSummary,
              projectCategory: row.projectCategory,
              submittedAt: row.submittedAt,
              reviewerNote: row.reviewerNote,
            }
          : null,
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
