/**
 * AdminAuditLog 閲覧用 Read-only Query Service の型定義 (#149)
 *
 * CQRS の Q 側。実装は `KyselyAdminAuditLogQueryService`、書き込みは
 * `KyselyAdminAuditLogAdapter.ts#writeAdminAuditLog` で行われる (#145 / #157 H2)。
 * 実装（Kysely を読み込む）と分けているのは、メイン barrel から型だけを公開するため。
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
  /** jsonb 由来。UI 側でプレビュー文字列化する想定 */
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
