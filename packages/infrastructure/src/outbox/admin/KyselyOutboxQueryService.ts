import type { SelectQueryBuilder } from "kysely";
import { db } from "../../database/kysely/client";
import type { DB } from "../../database/kysely/types";
import type { OutboxListItem, OutboxSource, OutboxStatus } from "./PrismaOutboxQueryService";

// ステータス導出・バリデーション・型は Prisma 版と共通のものを再利用する（純粋関数 / 型のみ）。
export {
  deriveOutboxStatus,
  isValidSource,
  isValidStatus,
  type OutboxSource,
  type OutboxStatus,
  type OutboxListItem,
} from "./PrismaOutboxQueryService";

type OutboxTableName = "leader_application_outbox_messages" | "project_outbox_messages";

function tableFor(source: OutboxSource): OutboxTableName {
  return source === "leaderApplication"
    ? "leader_application_outbox_messages"
    : "project_outbox_messages";
}

/**
 * Kysely ベースの運営向け Outbox Read-only Query Service（Prisma 版からの移行 / #226）。
 *
 * `PrismaOutboxQueryService` と同一 API の drop-in。
 */
export class KyselyOutboxQueryService {
  async findMany(
    source: OutboxSource,
    options: { status?: OutboxStatus; page: number; perPage: number }
  ): Promise<{ items: OutboxListItem[]; totalCount: number }> {
    const offset = (options.page - 1) * options.perPage;
    const base = applyStatusFilter(db.selectFrom(tableFor(source)), options.status);

    const [rows, countRow] = await Promise.all([
      base
        .select([
          "id",
          "type",
          "createdAt",
          "sentAt",
          "attempts",
          "lastError",
          "nextRetryAt",
          "deadLetteredAt",
        ])
        .orderBy("createdAt", "desc")
        .limit(options.perPage)
        .offset(offset)
        .execute(),
      base.select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow(),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        createdAt: r.createdAt,
        sentAt: r.sentAt,
        attempts: r.attempts,
        lastError: r.lastError,
        nextRetryAt: r.nextRetryAt,
        deadLetteredAt: r.deadLetteredAt,
      })),
      totalCount: Number(countRow.count),
    };
  }

  async countByStatus(source: OutboxSource, status: OutboxStatus): Promise<number> {
    const row = await applyStatusFilter(db.selectFrom(tableFor(source)), status)
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async countIncomplete(source: OutboxSource): Promise<number> {
    const row = await db
      .selectFrom(tableFor(source))
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("sentAt", "is", null)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
}

/**
 * ステータス別の where 条件を適用する（Prisma 版 buildWhereClause と同一仕様）。
 * - 未指定: sentAt IS NULL（未送信のみ）
 * - pending: 未送信・未 dead-letter・attempts = 0
 * - retrying: 未送信・未 dead-letter・attempts >= 1
 * - dead-lettered: 未送信・deadLetteredAt IS NOT NULL
 * - sent: sentAt IS NOT NULL
 */
function applyStatusFilter(
  qb: SelectQueryBuilder<DB, OutboxTableName, object>,
  status?: OutboxStatus
): SelectQueryBuilder<DB, OutboxTableName, object> {
  if (!status) return qb.where("sentAt", "is", null);
  switch (status) {
    case "pending":
      return qb
        .where("sentAt", "is", null)
        .where("deadLetteredAt", "is", null)
        .where("attempts", "=", 0);
    case "retrying":
      return qb
        .where("sentAt", "is", null)
        .where("deadLetteredAt", "is", null)
        .where("attempts", ">=", 1);
    case "dead-lettered":
      return qb.where("sentAt", "is", null).where("deadLetteredAt", "is not", null);
    case "sent":
      return qb.where("sentAt", "is not", null);
  }
}
