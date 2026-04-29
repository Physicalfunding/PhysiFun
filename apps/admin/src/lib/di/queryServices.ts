import { unstable_cache } from "next/cache";
import {
  PrismaAdminAccountRepository,
  PrismaAdminAuditLogQueryService,
  PrismaLeaderApplicationQueryService,
  PrismaOutboxQueryService,
  PrismaProjectQueryService,
  type AdminAuditLogFilter,
  type AdminAuditLogListResult,
  type AdminAuditLogQueryService,
  type LeaderApplicationQueryService,
} from "@physifun/infrastructure";
import type { AdminAccountRepository } from "@physifun/domain";

/**
 * admin Server Component / Route Handler 向け QueryService DI ヘルパー
 *
 * 規約 (#119 / #131 Min-8):
 * - QueryService はモジュールレベルで `new` せず、ここで提供するファクトリを
 *   Server Component / Route Handler 内で都度呼び出す形でリクエストスコープに揃える。
 * - モジュールレベル生成は、テスト時のモック差し替えや将来のリクエスト単位
 *   Prisma Client 切替 (例: テナント別 RLS) を阻害するため避ける。
 * - infrastructure 層以外で Prisma を直接 `new` しない規約とも整合する。
 * - 戻り型は可能な限りインターフェースに揃え、呼び出し側を実装に依存させない。
 *   admin 専用メソッド (findManyForAdmin / findDetailForAdmin / countByStatus 等) は
 *   現状 Port インターフェース化されていないため、Project / Outbox のファクトリは
 *   当面具象クラスを返す (インターフェース化は別 Issue 予定)。
 */

/** LeaderApplication Query Service を生成 */
export function getLeaderApplicationQueryService(): LeaderApplicationQueryService {
  return new PrismaLeaderApplicationQueryService();
}

/**
 * Project Query Service を生成
 *
 * NOTE: admin 向けメソッド群 (findManyForAdmin / findDetailForAdmin / countByStatus) を
 * 扱うインターフェースが未整備のため具象クラスを返している。インターフェース化は別 Issue で対応予定。
 */
export function getProjectQueryService(): PrismaProjectQueryService {
  return new PrismaProjectQueryService();
}

/**
 * Outbox Query Service を生成
 *
 * NOTE: `PrismaOutboxQueryService` は現状インターフェースを implements しておらず
 * 具象クラスを返している。インターフェース化は別 Issue で対応予定。
 */
export function getOutboxQueryService(): PrismaOutboxQueryService {
  return new PrismaOutboxQueryService();
}

/**
 * AdminAccount Repository を生成 (#148)
 *
 * 運営メンバー管理 UI / API から利用する。
 * 戻り型は domain IF に揃えて呼び出し側が実装に依存しないようにする。
 */
export function getAdminAccountRepository(): AdminAccountRepository {
  return new PrismaAdminAccountRepository();
}

// ==================== AdminAuditLog メタデータキャッシュ ====================

/**
 * drop-down 用メタデータの再検証時間 (秒)。
 *
 * `/audit-logs` 画面ロードごとに `listDistinctActions` / `listDistinctTargetTypes`
 * が毎回発行されると 1 ロードあたり合計 4 クエリになる。action / targetType の
 * 追加頻度は低く 60 秒のラグは許容できるため、unstable_cache で束ねる (#170 M-3)。
 */
const DISTINCT_CACHE_REVALIDATE_SECONDS = 60;

/** unstable_cache のキー prefix。将来のタグ invalidation 用に一元管理 */
const DISTINCT_ACTIONS_CACHE_KEY = "admin-audit-log:distinct-actions";
const DISTINCT_TARGET_TYPES_CACHE_KEY = "admin-audit-log:distinct-target-types";

/**
 * `revalidateTag()` 用のタグ。action / targetType を個別に invalidation できるよう
 * 用途ごとに別タグを付ける (#179 M-2)。
 *
 * 例: 新しい action が DB に入った直後にキャッシュを吹き飛ばしたい場合は
 *     `revalidateTag(ADMIN_AUDIT_LOG_ACTIONS_TAG)` を呼ぶ。
 */
export const ADMIN_AUDIT_LOG_ACTIONS_TAG = "admin-audit-log-actions";
export const ADMIN_AUDIT_LOG_TARGET_TYPES_TAG = "admin-audit-log-target-types";

/**
 * distinct 系クエリをモジュールレベルで `unstable_cache` 化したファクトリ (#179 M-1)。
 *
 * Next.js のドキュメント推奨どおり、`unstable_cache(...)` 自体はモジュール読込時に
 * 一度だけ評価する。呼び出し側の変動する引数 (delegate / limit) は
 * 生成済み cached function の引数として渡すことで、呼び出しごとに新しい
 * cached 関数を作り直さないようにする。
 *
 * NOTE: `unstable_cache` は cached 関数への引数 (delegate / limit) を
 *       自動で key に含める (JSON シリアライズ)。`limit` は number なので
 *       そのままキー分離に機能する。`delegate` はクラスインスタンスのため
 *       実質空オブジェクト扱いだが、同一 inner を使い回す想定なので問題ない。
 */
const cachedListDistinctActions = unstable_cache(
  async (delegate: AdminAuditLogQueryService, limit: number) => delegate.listDistinctActions(limit),
  [DISTINCT_ACTIONS_CACHE_KEY],
  {
    revalidate: DISTINCT_CACHE_REVALIDATE_SECONDS,
    tags: [ADMIN_AUDIT_LOG_ACTIONS_TAG],
  }
);

const cachedListDistinctTargetTypes = unstable_cache(
  async (delegate: AdminAuditLogQueryService, limit: number) =>
    delegate.listDistinctTargetTypes(limit),
  [DISTINCT_TARGET_TYPES_CACHE_KEY],
  {
    revalidate: DISTINCT_CACHE_REVALIDATE_SECONDS,
    tags: [ADMIN_AUDIT_LOG_TARGET_TYPES_TAG],
  }
);

/**
 * AdminAuditLogQueryService の distinct 系メタデータだけを Next.js `unstable_cache`
 * で 60 秒キャッシュするラッパ。`findMany` はフィルタ / ページネーションごとに
 * 動的なため素通しする。
 *
 * NOTE: `unstable_cache` は RSC / Route Handler のスコープで動く Next.js 機能の
 * ため、infrastructure 層ではなく admin アプリ側の DI 層で wrap する。
 *
 * 実装は module-level で生成済みの cached 関数 (`cachedListDistinctActions` /
 * `cachedListDistinctTargetTypes`) に delegate / limit を渡すだけ。
 * こうすることでメソッド呼び出しごとに `unstable_cache(...)` を再生成する
 * オーバーヘッドを避ける (#179 M-1)。
 *
 * NOTE: unstable_cache は引数を JSON.stringify でキー化するため、
 * delegate（クラスインスタンス）は {} に潰れる。現状はリクエストごとに
 * new PrismaAdminAuditLogQueryService() を生成するシングルテナント前提で
 * 問題ないが、将来テナント別 Prisma Client や接続先切替を導入する場合は
 * テナント識別子を keyParts/tags に含めて誤キャッシュヒットを防ぐ拡張が必要。
 */
export class CachedAdminAuditLogQueryService implements AdminAuditLogQueryService {
  constructor(private readonly inner: AdminAuditLogQueryService) {}

  findMany(
    filter: AdminAuditLogFilter,
    pagination: { page: number; perPage: number }
  ): Promise<AdminAuditLogListResult> {
    return this.inner.findMany(filter, pagination);
  }

  listDistinctActions(limit = 100): Promise<string[]> {
    return cachedListDistinctActions(this.inner, limit);
  }

  listDistinctTargetTypes(limit = 100): Promise<string[]> {
    return cachedListDistinctTargetTypes(this.inner, limit);
  }
}

/**
 * AdminAuditLog Query Service を生成 (#149 / #170)
 *
 * distinct 系メタデータを `unstable_cache` (revalidate 60s) で包んで返す。
 * 戻り型は Port (`AdminAuditLogQueryService`) に揃え、呼び出し側を実装に
 * 依存させない。
 *
 * NOTE:
 * - listDistinctActions / listDistinctTargetTypes は unstable_cache で 60s キャッシュ
 * - findMany はフィルタ・ページネーションで結果が変動するためキャッシュ非対象（force-dynamic ページから素通し）
 * そのため audit-logs ページでは「最新の一覧」と「最大 60 秒古い drop-down 選択肢」が混在する。
 */
export function getAdminAuditLogQueryService(): AdminAuditLogQueryService {
  return new CachedAdminAuditLogQueryService(new PrismaAdminAuditLogQueryService());
}
