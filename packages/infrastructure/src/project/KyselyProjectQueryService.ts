import type { PublishStatus, ProjectPhase, ReviewAction } from "@physifun/domain";
import type {
  ProjectQueryPort,
  PublicProjectQueryPort,
  ProjectListResult,
  ProjectDetailDTO,
  ProjectPublicDetailDTO,
} from "@physifun/application";
import { db } from "../database/kysely/client";
import type { ProjectAdminListResult, ProjectAdminDetail } from "./PrismaProjectQueryService";

// admin 向け DTO 型は既存の Prisma 実装と共通のものを再利用する（PoC 段階のため）。
// Prisma 実装を撤去する際にこれらの型を中立なモジュールへ移動する。
export type {
  ProjectAdminListItem,
  ProjectAdminListResult,
  ProjectAdminDetail,
  ProjectReviewFeedbackHistoryItem,
} from "./PrismaProjectQueryService";

// ==================== 定数 ====================

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;

/** 詳細画面で表示する審査履歴の最大件数 */
const ADMIN_REVIEW_FEEDBACK_HISTORY_LIMIT = 5;

// ==================== Kysely 実装 ====================

/**
 * Kysely ベースの Project Query Service（PoC: Prisma 版からの移行）
 *
 * `PrismaProjectQueryService` と同一の公開メソッド・戻り値を提供する drop-in 実装。
 * CQRS の Q 側として、ドメインエンティティを経由せず DB 行から直接 DTO へマップする。
 */
export class KyselyProjectQueryService implements ProjectQueryPort, PublicProjectQueryPort {
  async findProjectsByOwner(
    accountId: string,
    params?: { page?: number; perPage?: number }
  ): Promise<ProjectListResult> {
    const page = params?.page ?? DEFAULT_PAGE;
    const perPage = params?.perPage ?? DEFAULT_PER_PAGE;
    const offset = (page - 1) * perPage;

    const [items, countRow] = await Promise.all([
      db
        .selectFrom("projects")
        .select(["id", "title", "status", "phase", "category", "coverImageUrl", "updatedAt"])
        .where("ownerAccountId", "=", accountId)
        .orderBy("updatedAt", "desc")
        .limit(perPage)
        .offset(offset)
        .execute(),
      db
        .selectFrom("projects")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("ownerAccountId", "=", accountId)
        .executeTakeFirstOrThrow(),
    ]);

    return {
      items: items.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        phase: row.phase,
        category: row.category,
        coverImageUrl: row.coverImageUrl,
        updatedAt: row.updatedAt,
      })),
      totalCount: Number(countRow.count),
    };
  }

  async findProjectDetailForOwner(
    projectId: string,
    accountId: string
  ): Promise<ProjectDetailDTO | null> {
    const row = await db
      .selectFrom("projects")
      .selectAll()
      .where("id", "=", projectId)
      .executeTakeFirst();

    if (!row) return null;

    // オーナーチェック
    if (row.ownerAccountId !== accountId) return null;

    // 最新の審査フィードバック 1 件（Prisma の include + take:1 相当）。
    // ネスト取得は別クエリに分割する（必要なら lateral join に置換可能）。
    const feedback = await db
      .selectFrom("project_review_feedbacks")
      .select(["action", "note", "reviewedAt"])
      .where("projectId", "=", projectId)
      .orderBy("reviewedAt", "desc")
      .limit(1)
      .executeTakeFirst();

    const latestFeedback = feedback
      ? {
          action: feedback.action as ReviewAction,
          note: feedback.note,
          reviewedAt: feedback.reviewedAt,
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
      status: row.status,
      phase: row.phase,
      activityPlan: row.activityPlan,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      latestFeedback,
    };
  }

  // ==================== ADMIN 向け ====================

  /**
   * 運営向けにプロジェクト一覧を取得する。
   * ステータスごとに並び替えの基準タイムスタンプを変える（Prisma 版と同一仕様）。
   */
  async findManyForAdmin(params: {
    status: PublishStatus;
    page: number;
    perPage: number;
  }): Promise<ProjectAdminListResult> {
    const offset = (params.page - 1) * params.perPage;

    let query = db
      .selectFrom("projects")
      .innerJoin("accounts", "accounts.id", "projects.ownerAccountId")
      .select([
        "projects.id",
        "projects.title",
        "projects.status",
        "projects.phase",
        "projects.category",
        "projects.prefectureCode",
        "projects.municipality",
        "projects.publishRequestedAt",
        "projects.publishedAt",
        "projects.updatedAt",
        "accounts.displayName as ownerDisplayName",
        "accounts.email as ownerEmail",
      ])
      .where("projects.status", "=", params.status);

    // ステータスごとに並び替えキーを切り替える（secondary key に updatedAt を必ず付与）。
    if (params.status === "PENDING_REVIEW") {
      query = query
        .orderBy("projects.publishRequestedAt", "desc")
        .orderBy("projects.updatedAt", "desc");
    } else if (params.status === "PUBLISHED") {
      query = query.orderBy("projects.publishedAt", "desc").orderBy("projects.updatedAt", "desc");
    } else {
      query = query.orderBy("projects.updatedAt", "desc");
    }

    const [rows, countRow] = await Promise.all([
      query.limit(params.perPage).offset(offset).execute(),
      db
        .selectFrom("projects")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("status", "=", params.status)
        .executeTakeFirstOrThrow(),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        phase: row.phase,
        category: row.category,
        prefectureCode: row.prefectureCode,
        municipality: row.municipality,
        ownerDisplayName: row.ownerDisplayName,
        ownerEmail: row.ownerEmail,
        sortedAt: pickAdminSortedAt(row, params.status),
        updatedAt: row.updatedAt,
      })),
      totalCount: Number(countRow.count),
    };
  }

  /**
   * 運営向けにプロジェクト詳細を取得する（owner-check なし）。
   * 審査履歴は最新 N 件を reviewedAt DESC で返す。
   */
  async findDetailForAdmin(projectId: string): Promise<ProjectAdminDetail | null> {
    const row = await db
      .selectFrom("projects")
      .innerJoin("accounts", "accounts.id", "projects.ownerAccountId")
      .select([
        "projects.id",
        "projects.title",
        "projects.summary",
        "projects.story",
        "projects.leaderIntro",
        "projects.coverImageUrl",
        "projects.category",
        "projects.prefectureCode",
        "projects.municipality",
        "projects.snsLinks",
        "projects.activityPlan",
        "projects.status",
        "projects.phase",
        "projects.publishRequestedAt",
        "projects.publishedAt",
        "projects.createdAt",
        "projects.updatedAt",
        "accounts.id as ownerId",
        "accounts.displayName as ownerDisplayName",
        "accounts.email as ownerEmail",
        "accounts.bio as ownerBio",
      ])
      .where("projects.id", "=", projectId)
      .executeTakeFirst();

    if (!row) return null;

    const feedbacks = await db
      .selectFrom("project_review_feedbacks")
      .innerJoin("admin_accounts", "admin_accounts.id", "project_review_feedbacks.reviewerId")
      .select([
        "project_review_feedbacks.id",
        "project_review_feedbacks.action",
        "project_review_feedbacks.note",
        "project_review_feedbacks.reviewerId",
        "admin_accounts.email as reviewerEmail",
        "project_review_feedbacks.reviewedAt",
      ])
      .where("project_review_feedbacks.projectId", "=", projectId)
      .orderBy("project_review_feedbacks.reviewedAt", "desc")
      .limit(ADMIN_REVIEW_FEEDBACK_HISTORY_LIMIT)
      .execute();

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
      status: row.status,
      phase: row.phase,
      publishRequestedAt: row.publishRequestedAt,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      owner: {
        accountId: row.ownerId,
        displayName: row.ownerDisplayName,
        email: row.ownerEmail,
        bio: row.ownerBio,
      },
      reviewFeedbacks: feedbacks.map((f) => ({
        id: f.id,
        action: f.action as ReviewAction,
        note: f.note,
        reviewerId: f.reviewerId,
        reviewerEmail: f.reviewerEmail,
        reviewedAt: f.reviewedAt,
      })),
    };
  }

  /** ステータス別件数（タブバッジ用） */
  async countByStatus(status: PublishStatus): Promise<number> {
    const row = await db
      .selectFrom("projects")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("status", "=", status)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  // ==================== 公開ページ向け ====================

  /**
   * slug で PUBLISHED プロジェクトを取得する（公開ページ用）。
   * where 条件で status: PUBLISHED を含めることで DRAFT / PENDING_REVIEW は取得しない。
   */
  async findPublishedBySlug(slug: string): Promise<ProjectPublicDetailDTO | null> {
    const row = await db
      .selectFrom("projects")
      .innerJoin("accounts", "accounts.id", "projects.ownerAccountId")
      .select([
        "projects.slug",
        "projects.title",
        "projects.summary",
        "projects.story",
        "projects.leaderIntro",
        "projects.coverImageUrl",
        "projects.category",
        "projects.prefectureCode",
        "projects.municipality",
        "projects.snsLinks",
        "projects.activityPlan",
        "projects.phase",
        "projects.publishedAt",
        "accounts.displayName as leaderDisplayName",
        "accounts.bio as leaderBio",
      ])
      .where("projects.slug", "=", slug)
      .where("projects.status", "=", "PUBLISHED")
      .executeTakeFirst();

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
      phase: row.phase,
      publishedAt: row.publishedAt,
      leader: {
        displayName: row.leaderDisplayName,
        bio: row.leaderBio,
      },
    };
  }
}

// ==================== ヘルパー ====================

/**
 * Prisma の Json? フィールドを snsLinks DTO にランタイム変換する。
 * 構造が期待と異なる場合や各 value が string でない場合は null に落とす。
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
