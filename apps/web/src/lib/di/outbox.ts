import {
  buildLeaderApplicationOutboxWorker,
  buildProjectOutboxWorker,
  prisma,
  type OutboxWorker,
  type ProjectOutboxWorker,
} from "@physifun/infrastructure";

/**
 * Outbox 周りの DI ヘルパー (#187 PR2)
 *
 * 実体は `@physifun/infrastructure/outbox/composition` に集約 (#187 PR2 review MEDIUM 1)。
 * apps/web と apps/admin の重複を防ぐためここでは薄い再エクスポートだけ行う。
 *
 * 規約 (#119): モジュールレベルで new せず、都度関数呼び出しで生成する。
 */

/** LeaderApplicationOutboxMessage 用 Worker (cron + inline trigger 両方から利用) */
export function getLeaderApplicationOutboxWorker(): OutboxWorker {
  return buildLeaderApplicationOutboxWorker(prisma);
}

/** ProjectOutboxMessage 用 Worker (cron + inline trigger 両方から利用) */
export function getProjectOutboxWorker(): ProjectOutboxWorker {
  return buildProjectOutboxWorker(prisma);
}
