import {
  PrismaLeaderApplicationQueryService,
  PrismaOutboxQueryService,
  PrismaProjectQueryService,
} from "@physifun/infrastructure";

/**
 * admin Server Component 向け QueryService DI ヘルパー
 *
 * 規約 (#131 Min-8):
 * - QueryService はモジュールレベルで `new` せず、ここで提供するファクトリを
 *   Server Component / Route Handler 内で都度呼び出す形でリクエストスコープに揃える。
 * - モジュールレベル生成は、テスト時のモック差し替えや将来のリクエスト単位
 *   Prisma Client 切替 (例: テナント別 RLS) を阻害するため避ける。
 * - infrastructure 層以外で Prisma を直接 `new` しない規約とも整合する。
 */
export function getLeaderApplicationQueryService(): PrismaLeaderApplicationQueryService {
  return new PrismaLeaderApplicationQueryService();
}

export function getProjectQueryService(): PrismaProjectQueryService {
  return new PrismaProjectQueryService();
}

export function getOutboxQueryService(): PrismaOutboxQueryService {
  return new PrismaOutboxQueryService();
}
