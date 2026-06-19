import type { ColumnType } from "kysely";

/**
 * Kysely 用のデータベース型定義（PoC: project ドメイン移行）
 *
 * ## 位置づけ
 * 本ファイルは `kysely-codegen` が実 DB から生成する出力の **手書きスタンドイン**。
 * 実運用では下記コマンドで自動生成し、本ファイルを置き換える想定:
 *
 * ```bash
 * bun run db:kysely:codegen
 * # = kysely-codegen --dialect postgres --out-file src/database/kysely/types.ts
 * ```
 *
 * ## 命名規約
 * - テーブル名は snake_case（Prisma の `@@map` で付与済み）。
 * - カラム名は **camelCase**（Prisma が引用識別子で作成済み。初期マイグレーション参照）。
 *   そのため Kysely でも camelCase のカラム名で参照する（Kysely が自動で引用する）。
 *
 * ## ヘルパー型
 * - `Generated<T>`     : DB 側 DEFAULT があり INSERT 省略可能なカラム。
 * - `Nullable<T>`      : NULL 許容かつ DEFAULT 無しのカラムを INSERT 省略可能にする。
 *   （kysely-codegen 既定では `T | null` で INSERT 必須になるが、本プロジェクトは
 *    Prisma の「省略したカラムは NULL」挙動に合わせて INSERT 省略可能側に倒す）
 * - `*Timestamp`       : `timestamp(3)` 系。読み取りは `Date`。
 */

export type Generated<T> = ColumnType<T, T | undefined, T>;
export type Nullable<T> = ColumnType<T | null, T | null | undefined, T | null>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;
export type GeneratedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
export type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;

// ==================== Enums（ネイティブ PostgreSQL enum） ====================

export type AccountStatus = "PENDING_EMAIL_CONFIRMATION" | "ACTIVE";
export type Role = "SUPPORTER" | "LEADER";
export type LeaderApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type LeaderApplicationRecruitmentType = "TIME" | "SKILL_ITEM";
export type PublishStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";
export type ProjectPhase = "VISION" | "PLANNING" | "READY" | "EXECUTION" | "ONGOING";
export type ReviewAction = "APPROVED" | "REJECTED" | "FORCE_UNPUBLISHED";
export type RecruitmentType = "ACTIVITY";
export type ApprovalMode = "AUTO" | "MANUAL";
export type SupportTicketStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
export type AdminAccountStatus = "ACTIVE" | "DISABLED";

/** jsonb の汎用オブジェクト型（読み取りは parse 済み、書き込みは JS 値を渡し pg が直列化） */
export type JsonObject = Record<string, unknown>;

// ==================== Tables ====================

export interface AccountsTable {
  id: string;
  email: string;
  displayName: string;
  phoneNumber: Nullable<string>;
  status: AccountStatus;
  passwordHash: Nullable<string>;
  roles: Generated<Role[]>;
  activationToken: Nullable<string>;
  activationTokenExp: NullableTimestamp;
  iconUrl: Nullable<string>;
  bio: Nullable<string>;
  snsLinks: Nullable<JsonObject>;
  contributedHours: Generated<number>;
  receivedHours: Generated<number>;
  createdAt: GeneratedTimestamp;
  updatedAt: Timestamp;
}

export interface LeaderApplicationsTable {
  id: string;
  accountId: string;
  status: LeaderApplicationStatus;
  reviewerNote: Nullable<string>;
  reviewedBy: Nullable<string>;
  phoneNumber: Nullable<string>;
  projectTitle: string;
  projectSummary: string;
  projectStory: string;
  projectCategory: string;
  prefectureCode: string;
  municipality: Nullable<string>;
  activityContent: Nullable<string>;
  snsLinks: Nullable<JsonObject>;
  progress: ProjectPhase;
  recruitmentTypes: LeaderApplicationRecruitmentType[];
  eventLocation: Nullable<string>;
  eventPeriod: Nullable<string>;
  recruitCount: Nullable<number>;
  skillItemNeeds: Nullable<string>;
  skillItemDeadline: Nullable<string>;
  timeReturn: Nullable<string>;
  skillItemReturn: Nullable<string>;
  experienceOffered: string;
  submittedAt: GeneratedTimestamp;
  reviewedAt: NullableTimestamp;
  createdAt: GeneratedTimestamp;
  updatedAt: Timestamp;
}

export interface ProjectsTable {
  id: string;
  ownerAccountId: string;
  slug: Nullable<string>;
  title: string;
  summary: Nullable<string>;
  story: Nullable<string>;
  leaderIntro: Nullable<string>;
  coverImageUrl: Nullable<string>;
  category: Nullable<string>;
  prefectureCode: Nullable<string>;
  municipality: Nullable<string>;
  snsLinks: Nullable<JsonObject>;
  activityPlan: Nullable<string>;
  status: Generated<PublishStatus>;
  phase: Generated<ProjectPhase>;
  reviewedBy: Nullable<string>;
  forcedUnpublishedBy: Nullable<string>;
  publishRequestedAt: NullableTimestamp;
  publishedAt: NullableTimestamp;
  createdAt: GeneratedTimestamp;
  updatedAt: Timestamp;
}

export interface ProjectReviewFeedbacksTable {
  id: string;
  projectId: string;
  reviewerId: string;
  action: ReviewAction;
  note: Nullable<string>;
  reviewedAt: GeneratedTimestamp;
  createdAt: GeneratedTimestamp;
}

export interface SupportRecruitmentsTable {
  id: string;
  projectId: string;
  type: Generated<RecruitmentType>;
  title: string;
  description: string;
  createdAt: GeneratedTimestamp;
  updatedAt: Timestamp;
}

export interface RecruitmentSchedulesTable {
  id: string;
  supportRecruitmentId: string;
  date: Timestamp;
  startTime: string;
  endTime: string;
  capacityPerHour: number;
  approvalMode: Generated<ApprovalMode>;
  createdAt: GeneratedTimestamp;
  updatedAt: Timestamp;
}

export interface SupportTicketsTable {
  id: string;
  recruitmentScheduleId: string;
  supporterAccountId: string;
  duration: number;
  slotStart: string;
  companionCount: Generated<number>;
  status: Generated<SupportTicketStatus>;
  createdAt: GeneratedTimestamp;
  updatedAt: Timestamp;
}

/** Outbox は leader-application / project で同一構造 */
export interface OutboxMessagesTable {
  id: string;
  type: string;
  payload: unknown;
  createdAt: GeneratedTimestamp;
  sentAt: NullableTimestamp;
  attempts: Generated<number>;
  lastError: Nullable<string>;
  nextRetryAt: NullableTimestamp;
  deadLetteredAt: NullableTimestamp;
  claimedAt: NullableTimestamp;
  claimedBy: Nullable<string>;
}

export interface AdminAccountsTable {
  id: string;
  email: string;
  status: Generated<AdminAccountStatus>;
  lastLoginAt: NullableTimestamp;
  createdAt: GeneratedTimestamp;
  updatedAt: Timestamp;
}

export interface AdminSessionsTable {
  id: string;
  sessionToken: string;
  adminAccountId: string;
  expires: Timestamp;
  createdAt: GeneratedTimestamp;
  updatedAt: Timestamp;
}

export interface AdminAuditLogsTable {
  id: string;
  adminAccountId: string;
  adminSessionId: Nullable<string>;
  action: string;
  targetType: string;
  targetId: Nullable<string>;
  metadata: Nullable<JsonObject>;
  createdAt: GeneratedTimestamp;
}

export interface AdminVerificationTokensTable {
  identifier: string;
  token: string;
  expires: Timestamp;
}

// ==================== DB（Kysely<DB> のルート型） ====================

export interface DB {
  accounts: AccountsTable;
  leader_applications: LeaderApplicationsTable;
  projects: ProjectsTable;
  project_review_feedbacks: ProjectReviewFeedbacksTable;
  support_recruitments: SupportRecruitmentsTable;
  recruitment_schedules: RecruitmentSchedulesTable;
  support_tickets: SupportTicketsTable;
  leader_application_outbox_messages: OutboxMessagesTable;
  project_outbox_messages: OutboxMessagesTable;
  admin_accounts: AdminAccountsTable;
  admin_sessions: AdminSessionsTable;
  admin_audit_logs: AdminAuditLogsTable;
  admin_verification_tokens: AdminVerificationTokensTable;
}
