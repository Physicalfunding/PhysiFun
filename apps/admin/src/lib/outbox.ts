import { prisma } from "@physifun/infrastructure";

// ==================== 型定義 ====================

export type OutboxSource = "leaderApplication" | "project";

export type OutboxStatus = "pending" | "retrying" | "dead-lettered" | "sent";

export interface OutboxItemDto {
  id: string;
  type: string;
  createdAt: string;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  deadLetteredAt: string | null;
  status: OutboxStatus;
  source: OutboxSource;
}

const VALID_SOURCES: readonly OutboxSource[] = ["leaderApplication", "project"];
const VALID_STATUSES: readonly OutboxStatus[] = ["pending", "retrying", "dead-lettered", "sent"];

const SOURCE_LABELS: Record<OutboxSource, string> = {
  leaderApplication: "リーダー応募",
  project: "プロジェクト",
};

export function isValidSource(value: string): value is OutboxSource {
  return VALID_SOURCES.includes(value as OutboxSource);
}

export function getSourceLabel(source: OutboxSource): string {
  return SOURCE_LABELS[source];
}

export function isValidStatus(value: string): value is OutboxStatus {
  return VALID_STATUSES.includes(value as OutboxStatus);
}

// ==================== ステータス導出 ====================

interface OutboxRow {
  sentAt: Date | null;
  deadLetteredAt: Date | null;
  attempts: number;
}

export function deriveOutboxStatus(row: OutboxRow): OutboxStatus {
  if (row.sentAt !== null) return "sent";
  if (row.deadLetteredAt !== null) return "dead-lettered";
  if (row.attempts >= 1) return "retrying";
  return "pending";
}

// ==================== Prisma クエリヘルパー ====================

type OutboxWhereClause = {
  sentAt?: null | { not: null };
  deadLetteredAt?: null | { not: null };
  attempts?: number | { gte: number };
};

export function buildOutboxWhereClause(status?: OutboxStatus): OutboxWhereClause {
  if (!status) {
    // デフォルト: 未完了のみ（pending + retrying + dead-lettered）
    return { sentAt: null };
  }

  switch (status) {
    case "pending":
      return { sentAt: null, deadLetteredAt: null, attempts: 0 };
    case "retrying":
      return { sentAt: null, deadLetteredAt: null, attempts: { gte: 1 } };
    case "dead-lettered":
      return { deadLetteredAt: { not: null } };
    case "sent":
      return { sentAt: { not: null } };
  }
}

interface OutboxDbRow {
  id: string;
  type: string;
  createdAt: Date;
  sentAt: Date | null;
  attempts: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  deadLetteredAt: Date | null;
}

function toDto(row: OutboxDbRow, source: OutboxSource): OutboxItemDto {
  return {
    id: row.id,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    attempts: row.attempts,
    lastError: row.lastError,
    nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
    deadLetteredAt: row.deadLetteredAt?.toISOString() ?? null,
    status: deriveOutboxStatus(row),
    source,
  };
}

// Prisma delegate のプロパティ選択
const selectFields = {
  id: true,
  type: true,
  createdAt: true,
  sentAt: true,
  attempts: true,
  lastError: true,
  nextRetryAt: true,
  deadLetteredAt: true,
} as const;

export async function queryOutboxItems(
  source: OutboxSource,
  options: { status?: OutboxStatus; page: number; perPage: number }
): Promise<{ items: OutboxItemDto[]; totalCount: number }> {
  const where = buildOutboxWhereClause(options.status);
  const skip = (options.page - 1) * options.perPage;

  if (source === "leaderApplication") {
    const [rows, totalCount] = await Promise.all([
      prisma.leaderApplicationOutboxMessage.findMany({
        where,
        select: selectFields,
        orderBy: { createdAt: "desc" },
        skip,
        take: options.perPage,
      }),
      prisma.leaderApplicationOutboxMessage.count({ where }),
    ]);
    return { items: rows.map((r) => toDto(r, source)), totalCount };
  }

  const [rows, totalCount] = await Promise.all([
    prisma.projectOutboxMessage.findMany({
      where,
      select: selectFields,
      orderBy: { createdAt: "desc" },
      skip,
      take: options.perPage,
    }),
    prisma.projectOutboxMessage.count({ where }),
  ]);
  return { items: rows.map((r) => toDto(r, source)), totalCount };
}

export async function countOutboxByStatus(
  source: OutboxSource,
  status: OutboxStatus
): Promise<number> {
  const where = buildOutboxWhereClause(status);

  if (source === "leaderApplication") {
    return prisma.leaderApplicationOutboxMessage.count({ where });
  }
  return prisma.projectOutboxMessage.count({ where });
}

export async function countOutboxIncomplete(source: OutboxSource): Promise<number> {
  const where = { sentAt: null };
  if (source === "leaderApplication") {
    return prisma.leaderApplicationOutboxMessage.count({ where });
  }
  return prisma.projectOutboxMessage.count({ where });
}

/**
 * 手動リトライ: deadLetteredAt / nextRetryAt / lastError をクリアしてワーカー再処理対象に戻す。
 * attempts は意図的にリセットしない（監査証跡として保持し、過去の試行回数を確認可能にする）。
 *
 * sentAt が既に設定済みの場合は更新せず 0 件を返す（TOCTOU 防止）。
 */
export async function retryOutboxMessage(
  source: OutboxSource,
  id: string
): Promise<{ count: number }> {
  const where = { id, sentAt: null };
  const data = {
    deadLetteredAt: null,
    nextRetryAt: null,
    lastError: null,
  };
  if (source === "leaderApplication") {
    return prisma.leaderApplicationOutboxMessage.updateMany({ where, data });
  }
  return prisma.projectOutboxMessage.updateMany({ where, data });
}

/**
 * 手動完了マーク: sentAt を設定して処理済みにする。
 *
 * sentAt が既に設定済みの場合は更新せず 0 件を返す（TOCTOU 防止）。
 */
export async function completeOutboxMessage(
  source: OutboxSource,
  id: string
): Promise<{ count: number }> {
  const where = { id, sentAt: null };
  const data = { sentAt: new Date() };
  if (source === "leaderApplication") {
    return prisma.leaderApplicationOutboxMessage.updateMany({ where, data });
  }
  return prisma.projectOutboxMessage.updateMany({ where, data });
}
