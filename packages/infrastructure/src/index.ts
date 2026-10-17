// ==================== @physifun/infrastructure の公開 API ====================
// apps / tests はすべてここから import する（#256 で Kysely 実装のサブバレルを統合）。
// クライアントコンポーネントからは型だけを import すること（値を import すると pg / Kysely がバンドルに入る）。

export { isUniqueConstraintError } from "./database/isUniqueConstraintError";

export type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "./outbox";
export {
  OutboxWorkerBase,
  type OutboxDelegate,
  type OutboxRow,
  type OutboxUpdate,
  type OutboxWorkerOptions,
  ActivationEmailProcessor,
  ACTIVATION_EMAIL_TYPE,
  type ActivationEmailPayload,
  LeaderApplicationApprovedNotifyProcessor,
  LEADER_APPLICATION_APPROVED_NOTIFY_TYPE,
  type LeaderApplicationApprovedNotifyPayload,
  LeaderApplicationRejectedNotifyProcessor,
  LEADER_APPLICATION_REJECTED_NOTIFY_TYPE,
  type LeaderApplicationRejectedNotifyPayload,
  AdminPublishRequestNotifyProcessor,
  ADMIN_PUBLISH_REQUEST_NOTIFY_TYPE,
  type AdminPublishRequestNotifyPayload,
  ProjectPublishApprovedNotifyProcessor,
  PROJECT_PUBLISH_APPROVED_NOTIFY_TYPE,
  type ProjectPublishApprovedPayload,
  ProjectPublishRejectedNotifyProcessor,
  LEADER_PUBLISH_REJECTED_NOTIFY_TYPE,
  type ProjectPublishRejectedPayload,
  ProjectForceUnpublishedNotifyProcessor,
  PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE,
  type ProjectForceUnpublishedPayload,
  type AccountEmailLookup,
} from "./outbox";

export type { MailMessage, MailSender, MailSendError } from "./mail";
export { ResendMailSender } from "./mail";
export { NoopMailSender } from "./mail";

export {
  createRateLimiter,
  type RateLimiter,
  type RateLimitResult,
  type RateLimitRule,
} from "./rate-limit/createRateLimiter";

export { createSendAdminMagicLink } from "./admin-account/sendAdminMagicLink";
export {
  buildMagicLinkHmacPayload,
  computeMagicLinkSignature,
  signMagicLinkUrl,
  verifyMagicLinkSignature,
  getAdminMagicLinkHmacSecret,
  MAGIC_LINK_SIGNATURE_PARAM,
  MAGIC_LINK_EXPIRES_PARAM,
  type MagicLinkVerifyResult,
} from "./admin-account/magicLinkHmac";
export type {
  AdminAuditLogQueryService,
  AdminAuditLogListItem,
  AdminAuditLogListResult,
  AdminAuditLogFilter,
} from "./admin-account/adminAuditLogQueryTypes";

export { BcryptPasswordHasher } from "./security/BcryptPasswordHasher";

export type {
  LeaderApplicationQueryService,
  LeaderApplicationListItem,
  LeaderApplicationListResult,
  LeaderApplicationDetail,
} from "./leader-application/leaderApplicationQueryTypes";

export {
  deriveOutboxStatus,
  isValidSource as isValidOutboxSource,
  isValidStatus as isValidOutboxStatus,
} from "./outbox/admin/outboxStatus";
export type { OutboxSource, OutboxStatus, OutboxListItem } from "@physifun/application";

// ==================== Kysely 実装（DB アクセス） ====================
export { db as kyselyDb, kyselyPool } from "./database/kysely/client";
export type { DB as KyselyDB } from "./database/kysely/types";
export { KyselyProjectQueryService } from "./project/KyselyProjectQueryService";
export { KyselyProjectCommandAdapter } from "./project/KyselyProjectCommandAdapter";

// leader-application ドメイン（#222）
export { KyselyLeaderApplicationQueryService } from "./leader-application/KyselyLeaderApplicationQueryService";
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
export { KyselyAdminAuditLogQueryService } from "./admin-account/KyselyAdminAuditLogQueryService";
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
export { KyselyOutboxQueryService } from "./outbox/admin/KyselyOutboxQueryService";
export { KyselyOutboxCommandAdapter } from "./outbox/admin/KyselyOutboxCommandAdapter";
