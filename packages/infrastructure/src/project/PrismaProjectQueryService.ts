import type { PublishStatus, ProjectPhase, ReviewAction } from "@physifun/domain";
import type {
  ProjectQueryPort,
  ProjectListResult,
  ProjectDetailDTO,
} from "@physifun/application";
import { prisma } from "../database/client";

// ==================== Prisma 実装 ====================

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;

/**
 * Prisma ベースの Project Query Service
 *
 * CQRS の Q 側。ドメインエンティティを経由せず、
 * Prisma から直接 DTO にマッピングする。
 */
export class PrismaProjectQueryService implements ProjectQueryPort {
  async findProjectsByOwner(
    accountId: string,
    params?: { page?: number; perPage?: number }
  ): Promise<ProjectListResult> {
    const page = params?.page ?? DEFAULT_PAGE;
    const perPage = params?.perPage ?? DEFAULT_PER_PAGE;
    const skip = (page - 1) * perPage;

    const where = { ownerAccountId: accountId };

    const [items, totalCount] = await Promise.all([
      prisma.project.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          phase: true,
          category: true,
          coverImageUrl: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: perPage,
      }),
      prisma.project.count({ where }),
    ]);

    return {
      items: items.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status as PublishStatus,
        phase: row.phase as ProjectPhase,
        category: row.category,
        coverImageUrl: row.coverImageUrl,
        updatedAt: row.updatedAt,
      })),
      totalCount,
    };
  }

  async findProjectDetailForOwner(
    projectId: string,
    accountId: string
  ): Promise<ProjectDetailDTO | null> {
    const row = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        reviewFeedbacks: {
          orderBy: { reviewedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!row) return null;

    // オーナーチェック
    if (row.ownerAccountId !== accountId) return null;

    const latestFeedback =
      row.reviewFeedbacks.length > 0
        ? {
            action: row.reviewFeedbacks[0].action as ReviewAction,
            note: row.reviewFeedbacks[0].note,
            reviewedAt: row.reviewFeedbacks[0].reviewedAt,
          }
        : null;

    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      body: row.story,
      leaderIntroduction: row.leaderIntro,
      coverImageUrl: row.coverImageUrl,
      category: row.category,
      prefectureCode: row.prefectureCode,
      municipality: row.municipality,
      snsLinks: row.snsLinks as ProjectDetailDTO["snsLinks"],
      status: row.status as PublishStatus,
      phase: row.phase as ProjectPhase,
      activityPlan: row.activityPlan,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      latestFeedback,
    };
  }
}
