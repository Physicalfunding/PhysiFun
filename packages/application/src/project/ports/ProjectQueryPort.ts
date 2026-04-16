/**
 * プロジェクト一覧・詳細の読み取り専用クエリポート
 *
 * アプリケーション層はこのインターフェースを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

// ==================== DTO 型 ====================

/**
 * プロジェクト一覧の 1 アイテム
 */
export interface ProjectListItem {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly phase: string;
  readonly category: string | null;
  readonly coverImageUrl: string | null;
  readonly updatedAt: Date;
}

/**
 * プロジェクト一覧のページネーション結果
 */
export interface ProjectListResult {
  readonly items: ProjectListItem[];
  readonly totalCount: number;
}

/**
 * プロジェクト詳細 DTO（オーナー向け）
 */
export interface ProjectDetailDTO {
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
    readonly x: string | null;
    readonly instagram: string | null;
    readonly facebook: string | null;
    readonly website: string | null;
  };
  readonly status: string;
  readonly phase: string;
  readonly activityPlan: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly latestFeedback: {
    readonly action: string;
    readonly note: string | null;
    readonly reviewedAt: Date;
  } | null;
}

// ==================== ポートインターフェース ====================

/**
 * プロジェクトの読み取り専用クエリポート
 */
export interface ProjectQueryPort {
  /**
   * オーナーのプロジェクト一覧を取得する。
   */
  findProjectsByOwner(
    accountId: string,
    params?: { page?: number; perPage?: number }
  ): Promise<ProjectListResult>;

  /**
   * オーナー向けプロジェクト詳細を取得する。
   *
   * accountId がオーナーでない場合は null を返す。
   */
  findProjectDetailForOwner(projectId: string, accountId: string): Promise<ProjectDetailDTO | null>;
}
