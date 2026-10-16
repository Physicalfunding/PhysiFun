// ==================== メイン barrel ====================
// DB アクセス（Kysely）を含む実装は、ESM 専用の kysely を当時の Jest (CommonJS) から切り離す目的で
// メインの index には載せず、サブバレル `@physifun/infrastructure/src/kysely` に分離している
// （Jest は #253 で撤去済み。統合は別途対応）。
// ここには DB に依存しない実装と、型・純粋関数だけを置く。

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
// NOTE: Kysely を読み込む Worker composition（buildLeader/ProjectOutboxWorker）は
// サブバレル `@physifun/infrastructure/src/kysely` から公開する（#226 / ESM・Jest 隔離）。

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
