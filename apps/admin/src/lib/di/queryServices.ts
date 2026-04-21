import {
  PrismaAdminAccountRepository,
  PrismaLeaderApplicationQueryService,
  PrismaOutboxQueryService,
  PrismaProjectQueryService,
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
