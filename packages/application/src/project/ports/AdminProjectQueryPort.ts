import type { PublishStatus, ProjectPhase, ReviewAction } from "@physifun/domain";

/**
 * 運営（admin）向けプロジェクトクエリポート
 *
 * CQRS の Q 側。owner-check なしでプロジェクトを横断取得する運営審査用の読み取り専用ポート。
 * アプリケーション層がインターフェースを定義し、インフラ層（Kysely / Prisma）が実装を提供する。
 *
 * リーダー向け / 公開ページ向けは `ProjectQueryPort` / `PublicProjectQueryPort` を参照。
 */

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

// ==================== ポートインターフェース ====================

/**
 * 運営向けプロジェクトクエリポート（owner-check なし）
 */
export interface AdminProjectQueryPort {
  /**
   * 運営向けにプロジェクト一覧を取得する。
   *
   * ステータスごとに並び替えの基準タイムスタンプを変える:
   * - PENDING_REVIEW: publishRequestedAt DESC
   * - PUBLISHED:      publishedAt        DESC
   * - DRAFT:          updatedAt          DESC
   */
  findManyForAdmin(params: {
    status: PublishStatus;
    page: number;
    perPage: number;
  }): Promise<ProjectAdminListResult>;

  /**
   * 運営向けにプロジェクト詳細を取得する（owner-check なし）。
   * 審査履歴は最新 N 件を reviewedAt DESC で返す。存在しなければ null。
   */
  findDetailForAdmin(projectId: string): Promise<ProjectAdminDetail | null>;

  /** ステータス別件数（タブバッジ用） */
  countByStatus(status: PublishStatus): Promise<number>;
}
