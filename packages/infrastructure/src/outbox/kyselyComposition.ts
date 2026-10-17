import { KyselyOutboxDelegate } from "./KyselyOutboxDelegate";
import { OutboxWorkerBase, type OutboxWorkerOptions } from "./OutboxWorkerBase";
import { getAdminNotificationEmail, getAppUrl, getMailSender } from "./composition-env";
import { ActivationEmailProcessor } from "./processors/ActivationEmailProcessor";
import { AdminPublishRequestNotifyProcessor } from "./processors/AdminPublishRequestNotifyProcessor";
import { KyselyAccountEmailLookup } from "./processors/KyselyAccountEmailLookup";
import { LeaderApplicationApprovedNotifyProcessor } from "./processors/LeaderApplicationApprovedNotifyProcessor";
import { LeaderApplicationRejectedNotifyProcessor } from "./processors/LeaderApplicationRejectedNotifyProcessor";
import { ProjectForceUnpublishedNotifyProcessor } from "./processors/ProjectForceUnpublishedNotifyProcessor";
import { ProjectPublishApprovedNotifyProcessor } from "./processors/ProjectPublishApprovedNotifyProcessor";
import { ProjectPublishRejectedNotifyProcessor } from "./processors/ProjectPublishRejectedNotifyProcessor";

/**
 * Outbox Worker の DI 集約（#226 で Kysely デリゲートへ移行）。
 *
 * claim/送信ループは `OutboxWorkerBase` + `KyselyOutboxDelegate`（FOR UPDATE SKIP LOCKED）に委譲し、
 * processor 側の email ルックアップは `KyselyAccountEmailLookup` を使う（#230 で Prisma 版から移行）。
 *
 * 公開は `@physifun/infrastructure`（`src/index.ts`）から行う。
 */

/**
 * LeaderApplicationOutboxMessage 用 Worker を組み立てる。
 *
 * 登録 processor: ACTIVATION_EMAIL / approved.notify_applicant / rejected.notify_applicant
 */
export function buildLeaderApplicationOutboxWorker(
  options?: OutboxWorkerOptions
): OutboxWorkerBase {
  const mailSender = getMailSender();
  const appUrl = getAppUrl();
  const accountEmailLookup = new KyselyAccountEmailLookup();

  return new OutboxWorkerBase(
    new KyselyOutboxDelegate("leader_application_outbox_messages"),
    [
      new ActivationEmailProcessor(mailSender, appUrl),
      new LeaderApplicationApprovedNotifyProcessor(mailSender, appUrl),
      new LeaderApplicationRejectedNotifyProcessor(mailSender, accountEmailLookup),
    ],
    options
  );
}

/**
 * ProjectOutboxMessage 用 Worker を組み立てる。
 *
 * 登録 processor: admin_publish_request / project_publish_approved /
 * project_publish_rejected / project_force_unpublished
 */
export function buildProjectOutboxWorker(options?: OutboxWorkerOptions): OutboxWorkerBase {
  const mailSender = getMailSender();
  const appUrl = getAppUrl();
  const accountEmailLookup = new KyselyAccountEmailLookup();

  return new OutboxWorkerBase(
    new KyselyOutboxDelegate("project_outbox_messages"),
    [
      new AdminPublishRequestNotifyProcessor(mailSender, getAdminNotificationEmail(), appUrl),
      new ProjectPublishApprovedNotifyProcessor(mailSender, accountEmailLookup, appUrl),
      new ProjectPublishRejectedNotifyProcessor(mailSender, accountEmailLookup, appUrl),
      new ProjectForceUnpublishedNotifyProcessor(mailSender, accountEmailLookup, appUrl),
    ],
    options
  );
}
