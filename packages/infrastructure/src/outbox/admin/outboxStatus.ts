import type { OutboxSource, OutboxStatus } from "@physifun/application";

/**
 * 運営アプリの Outbox 画面で使うステータス導出・バリデーションの純粋関数
 *
 * DB に依存しないため、実装（Kysely を読み込む）とは分けてメイン barrel から公開する。
 */

// ==================== ステータス導出 ====================

export function deriveOutboxStatus(row: {
  sentAt: Date | null;
  deadLetteredAt: Date | null;
  attempts: number;
}): OutboxStatus {
  if (row.sentAt !== null) return "sent";
  if (row.deadLetteredAt !== null) return "dead-lettered";
  if (row.attempts >= 1) return "retrying";
  return "pending";
}

// ==================== バリデーション ====================

const VALID_SOURCES: readonly OutboxSource[] = ["leaderApplication", "project"];
const VALID_STATUSES: readonly OutboxStatus[] = ["pending", "retrying", "dead-lettered", "sent"];

export function isValidSource(value: string): value is OutboxSource {
  return VALID_SOURCES.includes(value as OutboxSource);
}

export function isValidStatus(value: string): value is OutboxStatus {
  return VALID_STATUSES.includes(value as OutboxStatus);
}
