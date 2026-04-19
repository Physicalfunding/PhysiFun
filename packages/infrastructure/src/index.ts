export { prisma } from "./database/client";

export type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "./outbox";
export {
  OutboxWorker,
  ActivationEmailProcessor,
  ACTIVATION_EMAIL_TYPE,
  type ActivationEmailPayload,
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
