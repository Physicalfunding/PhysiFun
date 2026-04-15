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
  PrismaLeaderApplicationQueryService,
  type LeaderApplicationQueryService,
  type LeaderApplicationListItem,
  type LeaderApplicationListResult,
  type LeaderApplicationDetail,
} from "./leader-application/PrismaLeaderApplicationQueryService";

export { PrismaApproveLeaderApplicationAdapter } from "./leader-application/PrismaApproveLeaderApplicationAdapter";
export { PrismaRejectLeaderApplicationAdapter } from "./leader-application/PrismaRejectLeaderApplicationAdapter";

export {
  PrismaProjectQueryService,
  type ProjectQueryService,
  type ProjectListItem,
  type ProjectListResult,
  type ProjectDetailDTO,
} from "./project/PrismaProjectQueryService";

export { PrismaProjectCommandAdapter } from "./project/PrismaProjectCommandAdapter";

// Prisma Client のクラスや runtime 値は再エクスポートしない
// (`PrismaClient` を apps/web 側で new できないようにするため)。
// モデル型・enum 値は必要になった時点で type-only 再エクスポートを追加する。
// 例:
//   export type { Account, LeaderApplication, Project, Prisma } from "@prisma/client";
//   export { AccountStatus, Role } from "@prisma/client";
