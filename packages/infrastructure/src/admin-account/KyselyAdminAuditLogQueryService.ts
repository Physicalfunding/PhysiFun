import type { SelectQueryBuilder } from "kysely";
import { db } from "../database/kysely/client";
import type { DB } from "../database/kysely/types";
import type {
  AdminAuditLogQueryService,
  AdminAuditLogFilter,
  AdminAuditLogListResult,
} from "./PrismaAdminAuditLogQueryService";

// DTO / IF 型は既存の Prisma 実装と共通のものを再利用する（移行期間中。Prisma 撤去時に中立モジュールへ移動）。
export type {
  AdminAuditLogQueryService,
  AdminAuditLogListItem,
  AdminAuditLogListResult,
  AdminAuditLogFilter,
} from "./PrismaAdminAuditLogQueryService";

/**
 * Kysely ベースの AdminAuditLog 読み取り Query Service（Prisma 版からの移行 / #224）
 *
 * `PrismaAdminAuditLogQueryService` と同一の公開メソッド・戻り値を提供する drop-in 実装。
 * CQRS の Q 側として、ドメインを経由せず DB 行から直接 DTO へマップする。
 */
export class KyselyAdminAuditLogQueryService implements AdminAuditLogQueryService {
  async findMany(
    filter: AdminAuditLogFilter,
    pagination: { page: number; perPage: number }
  ): Promise<AdminAuditLogListResult> {
    const offset = (pagination.page - 1) * pagination.perPage;

    // list / count で同一の from + join + where を使うため、フィルタ適用済みの base を共有する。
    const base = applyAuditLogFilters(
      db
        .selectFrom("admin_audit_logs")
        .innerJoin("admin_accounts", "admin_accounts.id", "admin_audit_logs.adminAccountId"),
      filter
    );

    const [rows, countRow] = await Promise.all([
      base
        .select([
          "admin_audit_logs.id",
          "admin_audit_logs.createdAt",
          "admin_audit_logs.adminAccountId",
          "admin_audit_logs.adminSessionId",
          "admin_audit_logs.action",
          "admin_audit_logs.targetType",
          "admin_audit_logs.targetId",
          "admin_audit_logs.metadata",
          "admin_accounts.email as adminEmail",
        ])
        // 同一ミリ秒 createdAt でもページネーションが重複・脱落しないよう id を第二キーに付与。
        .orderBy("admin_audit_logs.createdAt", "desc")
        .orderBy("admin_audit_logs.id", "desc")
        .limit(pagination.perPage)
        .offset(offset)
        .execute(),
      base.select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow(),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        adminAccountId: row.adminAccountId,
        adminEmail: row.adminEmail,
        adminSessionId: row.adminSessionId,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: row.metadata,
      })),
      totalCount: Number(countRow.count),
    };
  }

  async listDistinctActions(limit = 100): Promise<string[]> {
    const rows = await db
      .selectFrom("admin_audit_logs")
      .select("action")
      .distinct()
      .orderBy("action", "asc")
      .limit(limit)
      .execute();
    return rows.map((r) => r.action);
  }

  async listDistinctTargetTypes(limit = 100): Promise<string[]> {
    const rows = await db
      .selectFrom("admin_audit_logs")
      .select("targetType")
      .distinct()
      .orderBy("targetType", "asc")
      .limit(limit)
      .execute();
    return rows.map((r) => r.targetType);
  }
}

// ==================== Where 条件構築 ====================

/**
 * 監査ログのフィルタを where 句として適用する（list / count で共有）。
 *
 * - email: 運営者メール完全一致（小文字正規化）。admin_accounts を join 済み前提。
 * - action / targetType: 完全一致
 * - from / to: createdAt の半開区間 [from, to)
 */
function applyAuditLogFilters(
  qb: SelectQueryBuilder<DB, "admin_audit_logs" | "admin_accounts", object>,
  filter: AdminAuditLogFilter
): SelectQueryBuilder<DB, "admin_audit_logs" | "admin_accounts", object> {
  let q = qb;
  if (filter.email && filter.email.trim().length > 0) {
    q = q.where("admin_accounts.email", "=", filter.email.trim().toLowerCase());
  }
  if (filter.action && filter.action.trim().length > 0) {
    q = q.where("admin_audit_logs.action", "=", filter.action);
  }
  if (filter.targetType && filter.targetType.trim().length > 0) {
    q = q.where("admin_audit_logs.targetType", "=", filter.targetType);
  }
  if (filter.from) {
    q = q.where("admin_audit_logs.createdAt", ">=", filter.from);
  }
  if (filter.to) {
    // 半開区間 [from, to)。UI 層で to = 指定日 +1日 として渡される前提。
    q = q.where("admin_audit_logs.createdAt", "<", filter.to);
  }
  return q;
}
