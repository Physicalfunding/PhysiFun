import { prisma } from "../database/client";

// ==================== 型定義 ====================

/**
 * 一覧表示用の応募データ
 */
export interface LeaderApplicationListItem {
  readonly id: string;
  readonly accountId: string;
  readonly displayName: string;
  readonly email: string;
  readonly projectTitle: string;
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly submittedAt: Date;
  readonly reviewedAt: Date | null;
}

/**
 * 詳細表示用の応募データ
 */
export interface LeaderApplicationDetail {
  readonly id: string;
  readonly accountId: string;
  readonly displayName: string;
  readonly email: string;
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly reviewerNote: string | null;
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
  readonly reviewedAt: Date | null;
}

/**
 * 一覧取得の結果
 */
export interface LeaderApplicationListResult {
  readonly items: LeaderApplicationListItem[];
  readonly totalCount: number;
}

// ==================== Query Service インターフェース ====================

/**
 * LeaderApplication の読み取り専用 Query Service
 *
 * CQRS の Q 側。ドメインエンティティを経由せず、
 * Prisma から直接 DTO にマッピングする。
 */
export interface LeaderApplicationQueryService {
  findMany(params: {
    status?: "PENDING" | "APPROVED" | "REJECTED";
    page: number;
    perPage: number;
  }): Promise<LeaderApplicationListResult>;

  findById(id: string): Promise<LeaderApplicationDetail | null>;

  countByStatus(status: "PENDING" | "APPROVED" | "REJECTED"): Promise<number>;
}

// ==================== Prisma 実装 ====================

/**
 * Prisma ベースの LeaderApplication Query Service
 */
export class PrismaLeaderApplicationQueryService implements LeaderApplicationQueryService {
  async findMany(params: {
    status?: "PENDING" | "APPROVED" | "REJECTED";
    page: number;
    perPage: number;
  }): Promise<LeaderApplicationListResult> {
    const where = params.status ? { status: params.status } : {};
    const skip = (params.page - 1) * params.perPage;

    const [items, totalCount] = await Promise.all([
      prisma.leaderApplication.findMany({
        where,
        include: {
          account: {
            select: { displayName: true, email: true },
          },
        },
        orderBy: { submittedAt: "desc" },
        skip,
        take: params.perPage,
      }),
      prisma.leaderApplication.count({ where }),
    ]);

    return {
      items: items.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        displayName: row.account.displayName,
        email: row.account.email,
        projectTitle: row.projectTitle,
        status: row.status,
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt,
      })),
      totalCount,
    };
  }

  async findById(id: string): Promise<LeaderApplicationDetail | null> {
    const row = await prisma.leaderApplication.findUnique({
      where: { id },
      include: {
        account: {
          select: { displayName: true, email: true },
        },
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      accountId: row.accountId,
      displayName: row.account.displayName,
      email: row.account.email,
      status: row.status,
      reviewerNote: row.reviewerNote,
      projectTitle: row.projectTitle,
      projectSummary: row.projectSummary,
      projectStory: row.projectStory,
      projectCategory: row.projectCategory,
      prefectureCode: row.prefectureCode,
      municipality: row.municipality,
      plannedActivities: row.plannedActivities,
      snsLinks: row.snsLinks as LeaderApplicationDetail["snsLinks"],
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
    };
  }

  async countByStatus(status: "PENDING" | "APPROVED" | "REJECTED"): Promise<number> {
    return prisma.leaderApplication.count({ where: { status } });
  }
}
