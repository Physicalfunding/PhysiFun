import {
  ActivationEmailProcessor,
  AdminPublishRequestNotifyProcessor,
  LeaderApplicationApprovedNotifyProcessor,
  LeaderApplicationRejectedNotifyProcessor,
  NoopMailSender,
  OutboxWorker,
  PrismaAccountEmailLookup,
  ProjectForceUnpublishedNotifyProcessor,
  ProjectOutboxWorker,
  ProjectPublishApprovedNotifyProcessor,
  ProjectPublishRejectedNotifyProcessor,
  ResendMailSender,
  prisma,
  type AccountEmailLookup,
  type ActivationEmailPayload,
  type AdminPublishRequestNotifyPayload,
  type LeaderApplicationApprovedNotifyPayload,
  type LeaderApplicationRejectedNotifyPayload,
  type MailSender,
  type OutboxProcessor,
  type ProjectForceUnpublishedPayload,
  type ProjectPublishApprovedPayload,
  type ProjectPublishRejectedPayload,
} from "@physifun/infrastructure";

/**
 * Outbox 周りの DI ヘルパー (#187 PR2)
 *
 * apps/admin の各承認/却下/強制非公開ルートから `after()` 経由で呼び出される。
 * apps/web 側の `apps/web/src/lib/di/outbox.ts` とほぼ同じ構成だが、admin は
 * ACTIVATION_EMAIL を投函しないため対応 processor は除外している。
 *
 * メール本文に埋め込むリンクは **web origin** を指す必要があるため、
 * `APP_URL` には admin ではなく web 側のドメイン (例: https://physical-funding-staging.vercel.app)
 * を設定する。
 *
 * 規約 (#119): モジュールレベルで new せず、都度関数呼び出しで生成する。
 */

function getMailSender(): MailSender {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.MAIL_FROM ?? "noreply@physifun.com";
  if (!apiKey) {
    return new NoopMailSender();
  }
  return new ResendMailSender({ apiKey, fromAddress });
}

function getAppUrl(): string {
  const value = process.env.APP_URL;
  if (!value) {
    throw new Error(
      "APP_URL is not set. Set it to the canonical web origin (e.g. https://physical-funding-staging.vercel.app)"
    );
  }
  return value.replace(/\/+$/, "");
}

function getAdminNotificationEmail(): string {
  const value = process.env.ADMIN_EMAIL_LIST;
  if (!value) {
    throw new Error("ADMIN_EMAIL_LIST is not set. Set comma-separated admin emails.");
  }
  const first = value
    .split(",")
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (!first) {
    throw new Error("ADMIN_EMAIL_LIST is empty after parsing.");
  }
  return first;
}

function getAccountEmailLookup(): AccountEmailLookup {
  return new PrismaAccountEmailLookup(prisma);
}

// ---------- LeaderApplication outbox processors ----------

/**
 * ACTIVATION_EMAIL は web 側の応募フローで投函される type だが、admin の tick が
 * 該当 PENDING 行を拾った場合、対応 processor が未登録だと dead-letter 化する。
 * フェイルセーフとして admin 側にも登録しておく。
 */
function getActivationEmailProcessor(): OutboxProcessor<ActivationEmailPayload> {
  return new ActivationEmailProcessor(getMailSender(), getAppUrl());
}

function getLeaderApplicationApprovedNotifyProcessor(): OutboxProcessor<LeaderApplicationApprovedNotifyPayload> {
  return new LeaderApplicationApprovedNotifyProcessor(getMailSender(), getAppUrl());
}

function getLeaderApplicationRejectedNotifyProcessor(): OutboxProcessor<LeaderApplicationRejectedNotifyPayload> {
  return new LeaderApplicationRejectedNotifyProcessor(getMailSender(), getAccountEmailLookup());
}

// ---------- Project outbox processors ----------

function getAdminPublishRequestNotifyProcessor(): OutboxProcessor<AdminPublishRequestNotifyPayload> {
  return new AdminPublishRequestNotifyProcessor(
    getMailSender(),
    getAdminNotificationEmail(),
    getAppUrl()
  );
}

function getProjectPublishApprovedNotifyProcessor(): OutboxProcessor<ProjectPublishApprovedPayload> {
  return new ProjectPublishApprovedNotifyProcessor(
    getMailSender(),
    getAccountEmailLookup(),
    getAppUrl()
  );
}

function getProjectPublishRejectedNotifyProcessor(): OutboxProcessor<ProjectPublishRejectedPayload> {
  return new ProjectPublishRejectedNotifyProcessor(
    getMailSender(),
    getAccountEmailLookup(),
    getAppUrl()
  );
}

function getProjectForceUnpublishedNotifyProcessor(): OutboxProcessor<ProjectForceUnpublishedPayload> {
  return new ProjectForceUnpublishedNotifyProcessor(
    getMailSender(),
    getAccountEmailLookup(),
    getAppUrl()
  );
}

/**
 * LeaderApplicationOutboxMessage 用の Worker を返す。
 *
 * apps/admin の `applications/[id]/approve` と `applications/[id]/reject` の
 * inline trigger から利用される。ACTIVATION_EMAIL は admin 経路では発生しないが、
 * 万一 PENDING 行が残っていても拾えるよう web 側と同様に登録しても良い (将来検討)。
 */
export function getLeaderApplicationOutboxWorker(): OutboxWorker {
  return new OutboxWorker(prisma, [
    getActivationEmailProcessor(),
    getLeaderApplicationApprovedNotifyProcessor(),
    getLeaderApplicationRejectedNotifyProcessor(),
  ]);
}

/**
 * ProjectOutboxMessage 用の Worker を返す。
 *
 * apps/admin の `projects/[id]/approve|reject|force-unpublish` の inline trigger から
 * 利用される。
 */
export function getProjectOutboxWorker(): ProjectOutboxWorker {
  return new ProjectOutboxWorker(prisma, [
    getAdminPublishRequestNotifyProcessor(),
    getProjectPublishApprovedNotifyProcessor(),
    getProjectPublishRejectedNotifyProcessor(),
    getProjectForceUnpublishedNotifyProcessor(),
  ]);
}
