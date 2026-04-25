import { Prisma } from "@prisma/client";
import { prisma } from "../database/client";

/**
 * AdminAuditLog 閲覧用 Read-only Query Service (#149)
 *
 * CQRS の Q 側。書き込みは `PrismaAdminAuditLogAdapter.ts#writeAdminAuditLog` で
 * 行われる (#145 / #157 H2)。
 *
 * apps/admin の /audit-logs 画面 (Server Component) から直接呼び出す前提。
 *
 * #170 で Port 化し、`LeaderApplicationQueryService` と同様に interface を
 * 公開する形式に揃えた。DI 層 (`apps/admin/src/lib/di/queryServices.ts`) は
 * 戻り型を interface にして実装差し替え (キャッシュラッパ含む) を可能にする。
 */

// ==================== 型定義 ====================

/**
 * 一覧表示用の AdminAuditLog 行
 *
 * 書き込み時の `WriteAdminAuditLogParams` と型を揃えつつ、画面表示に必要な
 * 実行者 email (adminAccount.email) を JOIN 済みで持たせる。
 * adminSessionId はセッション失効後も履歴を残すため nullable。
 */
export interface AdminAuditLogListItem {
  readonly id: string;
  readonly createdAt: Date;
  readonly adminAccountId: string;
  readonly adminEmail: string;
  readonly adminSessionId: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  /** Prisma Json 由来。UI 側でプレビュー文字列化する想定 */
  readonly metadata: unknown;
}

/**
 * 一覧取得の結果
 */
export interface AdminAuditLogListResult {
  readonly items: AdminAuditLogListItem[];
  readonly totalCount: number;
}

/**
 * 一覧取得のフィルタ条件
 *
 * - email: 運営者のメールアドレス (完全一致。正規化のため小文字比較)
 * - action: "leader_application.approve" 等の action 完全一致
 * - targetType: "LeaderApplication" / "Project" 等の targetType 完全一致
 * - from / to: createdAt の範囲指定 (半開区間 [from, to))
 *   UI 層では `to = 指定日 +1 日 00:00:00 JST` を渡すことで「指定日を含む」挙動にする。
 */
export interface AdminAuditLogFilter {
  readonly email?: string;
  readonly action?: string;
  readonly targetType?: string;
  readonly from?: Date;
  readonly to?: Date;
}

// ==================== Query Service インターフェース ====================

/**
 * AdminAuditLog の読み取り専用 Query Service (Port)
 *
 * CQRS の Q 側インターフェース。`LeaderApplicationQueryService` に揃えて
 * DI 経由での差し替え (キャッシュラッパ / テストモック) を可能にする (#170)。
 */
export interface AdminAuditLogQueryService {
  findMany(
    filter: AdminAuditLogFilter,
    pagination: { page: number; perPage: number }
  ): Promise<AdminAuditLogListResult>;

  /**
   * 画面のフィルタ drop-down 用: 既存ログから action の一覧を distinct で取得する。
   */
  listDistinctActions(limit?: number): Promise<string[]>;

  /**
   * 画面のフィルタ drop-down 用: 既存ログから targetType の一覧を distinct で取得する。
   */
  listDistinctTargetTypes(limit?: number): Promise<string[]>;
}

// ==================== Prisma 実装 ====================

/**
 * Prisma ベースの AdminAuditLog 読み取り Query Service
 */
export class PrismaAdminAuditLogQueryService implements AdminAuditLogQueryService {
  /**
   * 監査ログを時系列 (新しい順) で取得する。
   *
   * - 2 クエリ (findMany + count) を並列で発行
   * - adminAccount.email を必ず JOIN する (画面表示の主キー)
   * - adminSessionId は SetNull 前提で nullable
   */
  async findMany(
    filter: AdminAuditLogFilter,
    pagination: { page: number; perPage: number }
  ): Promise<AdminAuditLogListResult> {
    const where = buildWhere(filter);
    const skip = (pagination.page - 1) * pagination.perPage;

    const [rows, totalCount] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        include: {
          adminAccount: {
            select: { email: true },
          },
        },
        // 同一ミリ秒の createdAt が発生した場合でもページネーションが重複・脱落しないよう
        // tie-breaker として id を第二キーに付与する。
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pagination.perPage,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return {
      items: rows.map(
        (row): AdminAuditLogListItem => ({
          id: row.id,
          createdAt: row.createdAt,
          adminAccountId: row.adminAccountId,
          adminEmail: row.adminAccount.email,
          adminSessionId: row.adminSessionId,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          // Prisma の Json カラムは `Prisma.JsonValue | null` 相当。
          // UI 側でプレビュー文字列化するため unknown で公開する。
          metadata: row.metadata,
        })
      ),
      totalCount,
    };
  }

  /**
   * 画面のフィルタ drop-down 用: 既存ログから action の一覧を distinct で取得する。
   * 件数が多くなっても memory に積みっぱなしにならないよう上限を設ける。
   *
   * NOTE: この `limit=100` は「drop-down に入れる distinct 値の最大数」であり、
   *       画面側の `PER_PAGE_MAX=50` (1 ページ表示件数上限) とは別概念。
   *       用途も単位も異なるため、数値を揃える必要はない。
   */
  async listDistinctActions(limit = 100): Promise<string[]> {
    const rows = await prisma.adminAuditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
      take: limit,
    });
    return rows.map((r) => r.action);
  }

  /**
   * 画面のフィルタ drop-down 用: 既存ログから targetType の一覧を distinct で取得する。
   * 件数が多くなっても memory に積みっぱなしにならないよう上限を設ける。
   *
   * NOTE: この `limit=100` は「drop-down に入れる distinct 値の最大数」であり、
   *       画面側の `PER_PAGE_MAX=50` (1 ページ表示件数上限) とは別概念。
   *       用途も単位も異なるため、数値を揃える必要はない。
   */
  async listDistinctTargetTypes(limit = 100): Promise<string[]> {
    const rows = await prisma.adminAuditLog.findMany({
      distinct: ["targetType"],
      select: { targetType: true },
      orderBy: { targetType: "asc" },
      take: limit,
    });
    return rows.map((r) => r.targetType);
  }
}

// ==================== Where 条件構築 ====================

function buildWhere(filter: AdminAuditLogFilter): Prisma.AdminAuditLogWhereInput {
  const where: Prisma.AdminAuditLogWhereInput = {};

  if (filter.email && filter.email.trim().length > 0) {
    // AdminAccount.email は seed / 作成時に小文字で保存する運用 (#157 H3)。
    // 大文字入力でも引けるよう小文字比較する。
    where.adminAccount = { email: filter.email.trim().toLowerCase() };
  }

  if (filter.action && filter.action.trim().length > 0) {
    where.action = filter.action;
  }

  if (filter.targetType && filter.targetType.trim().length > 0) {
    where.targetType = filter.targetType;
  }

  if (filter.from || filter.to) {
    where.createdAt = {};
    if (filter.from) {
      where.createdAt.gte = filter.from;
    }
    if (filter.to) {
      // 半開区間 [from, to)。UI 層で to = 指定日 +1日 00:00:00 JST として渡される前提。
      // lte + 23:59:59.999 丸め方式はミリ秒未満の境界で取りこぼす可能性があるため避ける。
      where.createdAt.lt = filter.to;
    }
  }

  return where;
}
