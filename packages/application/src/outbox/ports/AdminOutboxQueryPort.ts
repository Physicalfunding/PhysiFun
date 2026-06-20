/**
 * 運営（admin）向け Outbox クエリポート
 *
 * CQRS の Q 側。leaderApplication / project 各 Outbox の配送状況を運営画面向けに
 * 読み取り専用で取得する。アプリケーション層がインターフェースを定義し、
 * インフラ層（Kysely / Prisma）が実装を提供する。
 */

// ==================== DTO 型 ====================

export type OutboxSource = "leaderApplication" | "project";

export type OutboxStatus = "pending" | "retrying" | "dead-lettered" | "sent";

export interface OutboxListItem {
  readonly id: string;
  readonly type: string;
  readonly createdAt: Date;
  readonly sentAt: Date | null;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly nextRetryAt: Date | null;
  readonly deadLetteredAt: Date | null;
}

// ==================== ポートインターフェース ====================

/**
 * 運営向け Outbox 読み取り専用クエリポート
 */
export interface AdminOutboxQueryPort {
  /**
   * 指定ソースの Outbox メッセージをステータス絞り込み + ページネーションで取得する。
   * status 未指定時は未送信（sentAt IS NULL）のみを返す。
   */
  findMany(
    source: OutboxSource,
    options: { status?: OutboxStatus; page: number; perPage: number }
  ): Promise<{ items: OutboxListItem[]; totalCount: number }>;

  /** ステータス別件数 */
  countByStatus(source: OutboxSource, status: OutboxStatus): Promise<number>;

  /** 未完了（未送信）件数 */
  countIncomplete(source: OutboxSource): Promise<number>;
}
