/**
 * Kysely 実装のサブバレル（PoC: project ドメイン移行）
 *
 * ## なぜメインの `index.ts` と分けるのか
 * `kysely` は ESM 専用パッケージ（`type: module`、CJS ビルド無し）。一方 apps/web の
 * ユニットテストは Jest (CommonJS) で動き、`next/jest` の `transformIgnorePatterns` は
 * node_modules を変換対象から外す（しかも bun の `.bun/<pkg>@<ver>/` レイアウトのため
 * `transpilePackages` 方式も効かない）。
 *
 * そこで Kysely を読み込む実装は、全所から import されるメイン barrel には載せず、
 * このサブバレルに隔離する。Kysely を使う DI（project / leader-application / account ドメイン）
 * だけがここを import し、Prisma ベースの DI / それを読む Jest テストは Kysely を一切ロードしない。
 *
 * 利用側:
 *   import { KyselyProjectQueryService } from "@physifun/infrastructure/src/kysely";
 */
export { db as kyselyDb, kyselyPool } from "./database/kysely/client";
export type { DB as KyselyDB } from "./database/kysely/types";
export { KyselyProjectQueryService } from "./project/KyselyProjectQueryService";
export { KyselyProjectCommandAdapter } from "./project/KyselyProjectCommandAdapter";

// leader-application ドメイン（#222）
export {
  KyselyLeaderApplicationQueryService,
  type LeaderApplicationQueryService,
  type LeaderApplicationListItem,
  type LeaderApplicationListResult,
  type LeaderApplicationDetail,
} from "./leader-application/KyselyLeaderApplicationQueryService";
export {
  KyselySubmitLeaderApplicationAdapter,
  type AccountRow as SubmitLeaderApplicationAccountRow,
} from "./leader-application/KyselySubmitLeaderApplicationAdapter";
export { KyselyApproveLeaderApplicationAdapter } from "./leader-application/KyselyApproveLeaderApplicationAdapter";
export { KyselyRejectLeaderApplicationAdapter } from "./leader-application/KyselyRejectLeaderApplicationAdapter";

// account ドメイン（#223）
export {
  KyselyActivateAccountAdapter,
  type AccountForActivation,
} from "./account/KyselyActivateAccountAdapter";
export {
  KyselyAuthenticateAdapter,
  type AuthenticatedAccount,
  type AccountRole as AuthenticatedAccountRole,
} from "./account/KyselyAuthenticateAdapter";
export {
  KyselyCleanupExpiredAccountsAdapter,
  type CleanupExpiredAccountsPort,
} from "./account/KyselyCleanupExpiredAccountsAdapter";

// admin-account ドメイン（#224）
export { KyselyAdminAccountRepository } from "./admin-account/KyselyAdminAccountRepository";
export {
  KyselyAdminAuditLogQueryService,
  type AdminAuditLogQueryService,
  type AdminAuditLogListItem,
  type AdminAuditLogListResult,
  type AdminAuditLogFilter,
} from "./admin-account/KyselyAdminAuditLogQueryService";
export {
  writeAdminAuditLog,
  type WriteAdminAuditLogParams,
} from "./admin-account/KyselyAdminAuditLogAdapter";
export { KyselyAdminAuthGcAdapter } from "./admin-account/KyselyAdminAuthGcAdapter";
export {
  isActiveAdminByEmail,
  findAdminAccountIdByEmail,
} from "./admin-account/kyselyAdminAccountLookup";
export {
  revokeAdminSessions,
  disableAdminAccountAndRevokeSessions,
} from "./admin-account/kyselyAdminSession";
// NextAuth v4 カスタム Adapter（#225）
export { createAdminKyselyAdapter } from "./admin-account/AdminKyselyAdapter";

// outbox ドメイン（#226。claim を FOR UPDATE SKIP LOCKED 化）
export { KyselyOutboxDelegate, type OutboxTableName } from "./outbox/KyselyOutboxDelegate";
export {
  buildLeaderApplicationOutboxWorker,
  buildProjectOutboxWorker,
} from "./outbox/kyselyComposition";
export {
  KyselyOutboxQueryService,
  deriveOutboxStatus,
  isValidSource as isValidOutboxSource,
  isValidStatus as isValidOutboxStatus,
  type OutboxSource,
  type OutboxStatus,
  type OutboxListItem,
} from "./outbox/admin/KyselyOutboxQueryService";
export { KyselyOutboxCommandAdapter } from "./outbox/admin/KyselyOutboxCommandAdapter";
