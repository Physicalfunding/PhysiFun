import type {
  AdminOutboxQueryPort,
  OutboxSource,
  OutboxStatus,
  OutboxListItem,
} from "@physifun/application";
import { prisma } from "../../database/client";

// 型は application 層の AdminOutboxQueryPort に定義（#231）。
// 既存 import 互換のため infra からも type-only で再 export する。
export type { OutboxSource, OutboxStatus, OutboxListItem } from "@physifun/application";

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

// ==================== Where 条件構築 ====================

type OutboxWhereClause = {
  sentAt?: null | { not: null };
  deadLetteredAt?: null | { not: null };
  attempts?: number | { gte: number };
};

function buildWhereClause(status?: OutboxStatus): OutboxWhereClause {
  if (!status) {
    return { sentAt: null };
  }

  switch (status) {
    case "pending":
      return { sentAt: null, deadLetteredAt: null, attempts: 0 };
    case "retrying":
      return { sentAt: null, deadLetteredAt: null, attempts: { gte: 1 } };
    case "dead-lettered":
      return { sentAt: null, deadLetteredAt: { not: null } };
    case "sent":
      return { sentAt: { not: null } };
  }
}

// ==================== Prisma 選択フィールド ====================

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

// ==================== QueryService ====================

export class PrismaOutboxQueryService implements AdminOutboxQueryPort {
  async findMany(
    source: OutboxSource,
    options: { status?: OutboxStatus; page: number; perPage: number }
  ): Promise<{ items: OutboxListItem[]; totalCount: number }> {
    const where = buildWhereClause(options.status);
    const skip = (options.page - 1) * options.perPage;
    const queryArgs = {
      where,
      select: selectFields,
      orderBy: { createdAt: "desc" as const },
      skip,
      take: options.perPage,
    };

    if (source === "leaderApplication") {
      const [rows, totalCount] = await Promise.all([
        prisma.leaderApplicationOutboxMessage.findMany(queryArgs),
        prisma.leaderApplicationOutboxMessage.count({ where }),
      ]);
      return { items: rows, totalCount };
    }

    const [rows, totalCount] = await Promise.all([
      prisma.projectOutboxMessage.findMany(queryArgs),
      prisma.projectOutboxMessage.count({ where }),
    ]);
    return { items: rows, totalCount };
  }

  async countByStatus(source: OutboxSource, status: OutboxStatus): Promise<number> {
    const where = buildWhereClause(status);
    if (source === "leaderApplication") {
      return prisma.leaderApplicationOutboxMessage.count({ where });
    }
    return prisma.projectOutboxMessage.count({ where });
  }

  async countIncomplete(source: OutboxSource): Promise<number> {
    const where = { sentAt: null };
    if (source === "leaderApplication") {
      return prisma.leaderApplicationOutboxMessage.count({ where });
    }
    return prisma.projectOutboxMessage.count({ where });
  }
}
