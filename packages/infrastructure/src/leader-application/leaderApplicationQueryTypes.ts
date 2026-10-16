import type {
  LeaderApplicationRecruitmentType,
  LeaderApplicationStatus,
  ProjectPhase,
} from "@physifun/domain";

/**
 * LeaderApplication 読み取り用 Query Service の型定義
 *
 * 実装（Kysely を読み込む）と分けているのは、メイン barrel から型だけを公開するため。
 */

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
  readonly status: LeaderApplicationStatus;
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
  readonly status: LeaderApplicationStatus;
  readonly reviewerNote: string | null;
  readonly projectTitle: string;
  readonly projectSummary: string;
  readonly projectStory: string;
  readonly projectCategory: string;
  readonly prefectureCode: string;
  readonly municipality: string | null;
  /** Issue #192 PR3 で `plannedActivities` から改名・nullable 化 */
  readonly activityContent: string | null;
  readonly snsLinks: {
    x: string | null;
    instagram: string | null;
    facebook: string | null;
    website: string | null;
  } | null;

  // Issue #192 PR3 で追加された応募フォーム拡張フィールド (Admin 詳細表示用)
  readonly phoneNumber: string | null;
  readonly progress: ProjectPhase;
  readonly recruitmentTypes: LeaderApplicationRecruitmentType[];
  readonly eventLocation: string | null;
  readonly eventPeriod: string | null;
  readonly recruitCount: number | null;
  readonly skillItemNeeds: string | null;
  readonly skillItemDeadline: string | null;
  readonly timeReturn: string | null;
  readonly skillItemReturn: string | null;
  readonly experienceOffered: string | null;

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
 * DB から直接 DTO にマッピングする（実装は `KyselyLeaderApplicationQueryService`）。
 */
export interface LeaderApplicationQueryService {
  findMany(params: {
    status?: LeaderApplicationStatus;
    page: number;
    perPage: number;
  }): Promise<LeaderApplicationListResult>;

  findById(id: string): Promise<LeaderApplicationDetail | null>;

  countByStatus(status: LeaderApplicationStatus): Promise<number>;
}
