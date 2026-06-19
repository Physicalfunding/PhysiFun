export { prisma } from "./database/client";
export { isUniqueConstraintError } from "./database/isUniqueConstraintError";

export type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "./outbox";
export {
  OutboxWorker,
  ProjectOutboxWorker,
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
  PrismaAccountEmailLookup,
  buildLeaderApplicationOutboxWorker,
  buildProjectOutboxWorker,
} from "./outbox";

export type { MailMessage, MailSender, MailSendError } from "./mail";
export { ResendMailSender } from "./mail";
export { NoopMailSender } from "./mail";

export { PrismaCleanupExpiredAccountsAdapter } from "./account/PrismaCleanupExpiredAccountsAdapter";
export {
  PrismaActivateAccountAdapter,
  type AccountForActivation,
} from "./account/PrismaActivateAccountAdapter";
export {
  PrismaAuthenticateAdapter,
  type AuthenticatedAccount,
} from "./account/PrismaAuthenticateAdapter";
export { createAdminPrismaAdapter } from "./admin-account/AdminPrismaAdapter";
export { createSendAdminMagicLink } from "./admin-account/sendAdminMagicLink";
export { isActiveAdminByEmail } from "./admin-account/isActiveAdminByEmail";
export { findAdminAccountIdByEmail } from "./admin-account/findAdminAccountIdByEmail";
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
export {
  writeAdminAuditLog,
  type WriteAdminAuditLogParams,
} from "./admin-account/PrismaAdminAuditLogAdapter";
export {
  PrismaAdminAuditLogQueryService,
  type AdminAuditLogQueryService,
  type AdminAuditLogListItem,
  type AdminAuditLogListResult,
  type AdminAuditLogFilter,
} from "./admin-account/PrismaAdminAuditLogQueryService";
export { PrismaAdminAuthGcAdapter } from "./admin-account/PrismaAdminAuthGcAdapter";
export { PrismaAdminAccountRepository } from "./admin-account/PrismaAdminAccountRepository";
export { revokeAdminSessions } from "./admin-account/revokeAdminSessions";
export { disableAdminAccountAndRevokeSessions } from "./admin-account/disableAdminAccountAndRevokeSessions";

export { BcryptPasswordHasher } from "./security/BcryptPasswordHasher";

export {
  PrismaLeaderApplicationQueryService,
  type LeaderApplicationQueryService,
  type LeaderApplicationListItem,
  type LeaderApplicationListResult,
  type LeaderApplicationDetail,
} from "./leader-application/PrismaLeaderApplicationQueryService";

export { PrismaApproveLeaderApplicationAdapter } from "./leader-application/PrismaApproveLeaderApplicationAdapter";
export { PrismaRejectLeaderApplicationAdapter } from "./leader-application/PrismaRejectLeaderApplicationAdapter";
export {
  PrismaSubmitLeaderApplicationAdapter,
  type AccountRow as SubmitLeaderApplicationAccountRow,
} from "./leader-application/PrismaSubmitLeaderApplicationAdapter";

export {
  PrismaProjectQueryService,
  type ProjectAdminListItem,
  type ProjectAdminListResult,
  type ProjectAdminDetail,
  type ProjectReviewFeedbackHistoryItem,
} from "./project/PrismaProjectQueryService";

export { PrismaProjectCommandAdapter } from "./project/PrismaProjectCommandAdapter";

// ==================== Kysely 実装（PoC: project ドメイン移行） ====================
// Kysely 実装は ESM 専用パッケージ (kysely) を読み込むため、Jest (CommonJS) を使う
// apps/web の barrel import から切り離す目的で、メインの index には載せず
// サブバレル `@physifun/infrastructure/src/kysely` に分離している。
// 詳細は `.docs/db-migration-kysely-atlas.md` を参照。

export {
  PrismaOutboxQueryService,
  deriveOutboxStatus,
  isValidSource as isValidOutboxSource,
  isValidStatus as isValidOutboxStatus,
  type OutboxSource,
  type OutboxStatus,
  type OutboxListItem,
} from "./outbox/admin/PrismaOutboxQueryService";
export { PrismaOutboxCommandAdapter } from "./outbox/admin/PrismaOutboxCommandAdapter";

// Prisma Client のクラスや runtime 値は再エクスポートしない
// (`PrismaClient` を apps/web 側で new できないようにするため)。
// モデル型・enum 値は必要になった時点で type-only 再エクスポートを追加する。
// 例:
//   export type { Account, LeaderApplication, Project, Prisma } from "@prisma/client";
//   export { AccountStatus, Role } from "@prisma/client";
