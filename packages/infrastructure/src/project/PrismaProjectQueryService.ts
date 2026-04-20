import type { PublishStatus, ProjectPhase, ReviewAction } from "@physifun/domain";
import type {
  ProjectQueryPort,
  PublicProjectQueryPort,
  ProjectListResult,
  ProjectDetailDTO,
  ProjectPublicDetailDTO,
} from "@physifun/application";
import { prisma } from "../database/client";

// ==================== ADMIN 向け DTO ====================

/**
 * 運営審査一覧の 1 件
 *
 * リーダー向けの ProjectListResult とは別途定義し、owner 情報を付与する。
 */
export interface ProjectAdminListItem {
  readonly id: string;
  readonly title: string;
  readonly status: PublishStatus;
  readonly phase: ProjectPhase;
  readonly category: string | null;
  readonly prefectureCode: string | null;
  readonly municipality: string | null;
  readonly ownerDisplayName: string;
  readonly ownerEmail: string;
  /**
   * 並び替えおよび一覧表示で使う「更新タイムスタンプ」。
   * - PENDING_REVIEW: publishRequestedAt
   * - PUBLISHED:      publishedAt
   * - DRAFT:          updatedAt
   */
  readonly sortedAt: Date;
  readonly updatedAt: Date;
}

export interface ProjectAdminListResult {
  readonly items: ProjectAdminListItem[];
  readonly totalCount: number;
}

/**
 * ADMIN 向け審査フィードバック履歴 1 件
 */
export interface ProjectReviewFeedbackHistoryItem {
  readonly id: string;
  readonly action: ReviewAction;
  readonly note: string | null;
  readonly reviewerId: string;
  readonly reviewerEmail: string;
  readonly reviewedAt: Date;
}

/**
 * ADMIN 向け詳細 DTO
 *
 * owner-check なしで取得し、owner 情報・審査履歴を含める。
 */
export interface ProjectAdminDetail {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly body: string | null;
  readonly leaderIntroduction: string | null;
  readonly coverImageUrl: string | null;
  readonly category: string | null;
  readonly prefectureCode: string | null;
  readonly municipality: string | null;
  readonly snsLinks: {
    x: string | null;
    instagram: string | null;
    facebook: string | null;
    website: string | null;
  } | null;
  readonly activityPlan: string | null;
  readonly status: PublishStatus;
  readonly phase: ProjectPhase;
  readonly publishRequestedAt: Date | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly owner: {
    readonly accountId: string;
    readonly displayName: string;
    readonly email: string;
    readonly bio: string | null;
  };
  /** 最新 N 件の審査履歴 (reviewedAt 降順) */
  readonly reviewFeedbacks: ProjectReviewFeedbackHistoryItem[];
}

// ==================== 定数 ====================

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;

/** 詳細画面で表示する審査履歴の最大件数 */
const ADMIN_REVIEW_FEEDBACK_HISTORY_LIMIT = 5;

// ==================== Prisma 実装 ====================

/**
 * Prisma ベースの Project Query Service
 *
 * CQRS の Q 側。ドメインエンティティを経由せず、
 * Prisma から直接 DTO にマッピングする。
 *
 * リーダー向けメソッドと運営向けメソッドを同居させている:
 * - リーダー向け: findProjectsByOwner / findProjectDetailForOwner (owner-check あり)
 * - 運営向け    : findManyForAdmin / findDetailForAdmin / countByStatus (owner-check なし)
 */
export class PrismaProjectQueryService implements ProjectQueryPort, PublicProjectQueryPort {
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

  // ==================== ADMIN 向け ====================

  /**
   * 運営向けにプロジェクト一覧を取得する。
   *
   * ステータスごとに並び替えの基準タイムスタンプを変える:
   * - PENDING_REVIEW: publishRequestedAt DESC (申請が新しい順)
   * - PUBLISHED:      publishedAt        DESC (公開が新しい順)
   * - DRAFT:          updatedAt          DESC (更新が新しい順)
   */
  async findManyForAdmin(params: {
    status: PublishStatus;
    page: number;
    perPage: number;
  }): Promise<ProjectAdminListResult> {
    const skip = (params.page - 1) * params.perPage;
    const where = { status: params.status };

    const orderBy = pickAdminOrderBy(params.status);

    const [rows, totalCount] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          owner: {
            select: { displayName: true, email: true },
          },
        },
        orderBy,
        skip,
        take: params.perPage,
      }),
      prisma.project.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status as PublishStatus,
        phase: row.phase as ProjectPhase,
        category: row.category,
        prefectureCode: row.prefectureCode,
        municipality: row.municipality,
        ownerDisplayName: row.owner.displayName,
        ownerEmail: row.owner.email,
        sortedAt: pickAdminSortedAt(row, params.status),
        updatedAt: row.updatedAt,
      })),
      totalCount,
    };
  }

  /**
   * 運営向けにプロジェクト詳細を取得する。
   *
   * owner-check は行わない。審査履歴は最新 N 件を reviewedAt DESC で返す。
   */
  async findDetailForAdmin(projectId: string): Promise<ProjectAdminDetail | null> {
    const row = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { id: true, displayName: true, email: true, bio: true },
        },
        reviewFeedbacks: {
          include: {
            reviewer: {
              select: { email: true },
            },
          },
          orderBy: { reviewedAt: "desc" },
          take: ADMIN_REVIEW_FEEDBACK_HISTORY_LIMIT,
        },
      },
    });

    if (!row) return null;

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
      snsLinks: row.snsLinks as ProjectAdminDetail["snsLinks"],
      activityPlan: row.activityPlan,
      status: row.status as PublishStatus,
      phase: row.phase as ProjectPhase,
      publishRequestedAt: row.publishRequestedAt,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      owner: {
        accountId: row.owner.id,
        displayName: row.owner.displayName,
        email: row.owner.email,
        bio: row.owner.bio,
      },
      reviewFeedbacks: row.reviewFeedbacks.map((f) => ({
        id: f.id,
        action: f.action as ReviewAction,
        note: f.note,
        reviewerId: f.reviewerId,
        reviewerEmail: f.reviewer.email,
        reviewedAt: f.reviewedAt,
      })),
    };
  }

  /**
   * ステータス別件数（タブバッジ用）
   */
  async countByStatus(status: PublishStatus): Promise<number> {
    return prisma.project.count({ where: { status } });
  }

  // ==================== 公開ページ向け ====================

  /**
   * slug で PUBLISHED プロジェクトを取得する（公開ページ用）。
   *
   * where 条件で status: PUBLISHED を含めることで、
   * DRAFT / PENDING_REVIEW のレコードは取得しない。
   */
  async findPublishedBySlug(slug: string): Promise<ProjectPublicDetailDTO | null> {
    const row = await prisma.project.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: {
        owner: {
          select: { displayName: true, bio: true },
        },
      },
    });

    if (!row || !row.slug) return null;

    return {
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      body: row.story,
      leaderIntroduction: row.leaderIntro,
      coverImageUrl: row.coverImageUrl,
      category: row.category,
      prefectureCode: row.prefectureCode,
      municipality: row.municipality,
      snsLinks: parseSnsLinks(row.snsLinks),
      activityPlan: row.activityPlan,
      phase: row.phase as ProjectPhase,
      publishedAt: row.publishedAt,
      leader: {
        displayName: row.owner.displayName,
        bio: row.owner.bio,
      },
    };
  }
}

// ==================== ヘルパー ====================

/**
 * ステータスごとに並び替えキーを切り替える。
 *
 * 並び替え対象のタイムスタンプが null になっているレコード（例: PENDING_REVIEW なのに
 * publishRequestedAt が null）はデータ不整合だが、secondary key として updatedAt も指定し
 * 並び順が安定するようにする。
 */
function pickAdminOrderBy(status: PublishStatus) {
  switch (status) {
    case "PENDING_REVIEW":
      return [{ publishRequestedAt: "desc" as const }, { updatedAt: "desc" as const }];
    case "PUBLISHED":
      return [{ publishedAt: "desc" as const }, { updatedAt: "desc" as const }];
    case "DRAFT":
    default:
      return [{ updatedAt: "desc" as const }];
  }
}

/**
 * Prisma の Json? フィールドを snsLinks DTO にランタイム変換する。
 *
 * 構造が期待と異なる場合は null を返す。
 * 各 value が string でなければ null に落とす。
 */
function parseSnsLinks(raw: unknown): {
  x: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
} | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;

  const obj = raw as Record<string, unknown>;
  const asStringOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

  return {
    x: asStringOrNull(obj.x),
    instagram: asStringOrNull(obj.instagram),
    facebook: asStringOrNull(obj.facebook),
    website: asStringOrNull(obj.website),
  };
}

function pickAdminSortedAt(
  row: { publishRequestedAt: Date | null; publishedAt: Date | null; updatedAt: Date },
  status: PublishStatus
): Date {
  switch (status) {
    case "PENDING_REVIEW":
      return row.publishRequestedAt ?? row.updatedAt;
    case "PUBLISHED":
      return row.publishedAt ?? row.updatedAt;
    case "DRAFT":
    default:
      return row.updatedAt;
  }
}
