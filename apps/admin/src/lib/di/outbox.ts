import { prisma, type OutboxWorkerBase } from "@physifun/infrastructure";
import {
  buildLeaderApplicationOutboxWorker,
  buildProjectOutboxWorker,
} from "@physifun/infrastructure/src/kysely";

/**
 * Outbox 周りの DI ヘルパー (#187 PR2)
 *
 * 実体は `@physifun/infrastructure/outbox/composition` に集約 (#187 PR2 review MEDIUM 1)。
 * apps/web と apps/admin の重複を防ぐためここでは薄い再エクスポートだけ行う。
 *
 * メール本文に埋め込むリンクは **web origin** を指す必要があるため、
 * `APP_URL` には admin ではなく web 側のドメインを設定すること。
 *
 * 規約 (#119): モジュールレベルで new せず、都度関数呼び出しで生成する。
 */

/** LeaderApplicationOutboxMessage 用 Worker (admin の applications/[id]/approve|reject から利用) */
export function getLeaderApplicationOutboxWorker(): OutboxWorkerBase {
  return buildLeaderApplicationOutboxWorker(prisma);
}

/** ProjectOutboxMessage 用 Worker (admin の projects/[id]/approve|reject|force-unpublish から利用) */
export function getProjectOutboxWorker(): OutboxWorkerBase {
  return buildProjectOutboxWorker(prisma);
}
