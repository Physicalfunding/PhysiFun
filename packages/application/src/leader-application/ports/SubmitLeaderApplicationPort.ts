/**
 * SubmitLeaderApplicationUseCase が依存するポートインターフェース
 *
 * アプリケーション層は Prisma に直接依存せず、このポートを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

import type { LeaderApplicationRecruitmentType, ProjectPhase } from "@physifun/domain";

/**
 * アカウントの状態
 */
export type AccountStatus = "PENDING_EMAIL_CONFIRMATION" | "ACTIVE";

import type { AccountRole } from "../../shared/AccountRole";

/**
 * findByEmail で返すアカウント行の最小型
 */
export interface AccountRow {
  readonly id: string;
  readonly email: string;
  readonly status: AccountStatus;
}

/**
 * トランザクション内で実行する Account 作成パラメータ
 */
export interface CreateAccountParams {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  /**
   * 電話番号（任意、〜20 文字）
   * - Issue #192: 応募 API で受け取り、Account に保存する。
   * - 未入力の場合は `null`。
   */
  readonly phoneNumber: string | null;
  readonly status: AccountStatus;
  readonly roles: AccountRole[];
  readonly activationToken: string;
  readonly activationTokenExp: Date;
}

/**
 * トランザクション内で実行する LeaderApplication 作成パラメータ
 *
 * Issue #192 PR3 で大幅に拡張。条件付き必須は UseCase 側の Zod superRefine で担保し、
 * Port には正規化済みの値（不要フィールドは null）が渡される。
 */
export interface CreateLeaderApplicationParams {
  readonly id: string;
  readonly accountId: string;
  readonly status: "PENDING";

  // ProjectDraft（既存。文字数仮値が PR3 で改訂され、plannedActivities は activityContent にリネーム）
  readonly projectTitle: string;
  readonly projectSummary: string;
  readonly projectStory: string;
  readonly projectCategory: string;
  readonly prefectureCode: string;
  readonly municipality: string | null;
  readonly activityContent: string | null; // TIME 募集枠で必須、SKILL_ITEM 単独時は null
  readonly snsLinks: {
    x: string | null;
    instagram: string | null;
    facebook: string | null;
    website: string | null;
  } | null;

  // 応募スナップショット
  readonly phoneNumber: string | null;

  // 応募フォーム拡張 (Issue #192 PR3)
  readonly progress: ProjectPhase;
  readonly recruitmentTypes: readonly LeaderApplicationRecruitmentType[]; // 1件以上

  // TIME 募集枠の詳細
  readonly eventLocation: string | null;
  readonly eventPeriod: string | null;
  readonly recruitCount: number | null;

  // SKILL_ITEM 募集枠の詳細
  readonly skillItemNeeds: string | null;
  readonly skillItemDeadline: string | null;

  // リターン情報
  readonly timeReturn: string | null;
  readonly skillItemReturn: string | null;
  readonly experienceOffered: string | null; // 必須（アプリ層で担保）

  readonly submittedAt: Date;
}

/**
 * トランザクション内で実行する OutboxMessage 作成パラメータ
 */
export interface CreateOutboxMessageParams {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
}

/**
 * SubmitLeaderApplication ユースケースのポート
 *
 * トランザクション境界を含むすべての永続化操作をカプセル化する。
 * インフラ層が Prisma トランザクション等で実装する。
 */
export interface SubmitLeaderApplicationPort {
  /**
   * メールアドレスでアカウントを検索する。
   * トランザクション外で呼ばれる（重複チェック用）。
   */
  findAccountByEmail(email: string): Promise<AccountRow | null>;

  /**
   * アカウント作成 + リーダー応募作成 + Outbox メッセージ作成を
   * 1 つのトランザクションで実行する。
   */
  executeInTransaction(params: {
    account: CreateAccountParams;
    leaderApplication: CreateLeaderApplicationParams;
    outboxMessage: CreateOutboxMessageParams;
  }): Promise<void>;
}
