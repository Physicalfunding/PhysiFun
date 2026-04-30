import type { PrismaClient } from "@prisma/client";
import { NoopMailSender } from "../mail/NoopMailSender";
import { ResendMailSender } from "../mail/ResendMailSender";
import type { MailSender } from "../mail/types";
import { OutboxWorker } from "./OutboxWorker";
import { ProjectOutboxWorker } from "./ProjectOutboxWorker";
import type { OutboxWorkerOptions } from "./OutboxWorkerBase";
import { ActivationEmailProcessor } from "./processors/ActivationEmailProcessor";
import { AdminPublishRequestNotifyProcessor } from "./processors/AdminPublishRequestNotifyProcessor";
import { LeaderApplicationApprovedNotifyProcessor } from "./processors/LeaderApplicationApprovedNotifyProcessor";
import { LeaderApplicationRejectedNotifyProcessor } from "./processors/LeaderApplicationRejectedNotifyProcessor";
import { PrismaAccountEmailLookup } from "./processors/PrismaAccountEmailLookup";
import { ProjectForceUnpublishedNotifyProcessor } from "./processors/ProjectForceUnpublishedNotifyProcessor";
import { ProjectPublishApprovedNotifyProcessor } from "./processors/ProjectPublishApprovedNotifyProcessor";
import { ProjectPublishRejectedNotifyProcessor } from "./processors/ProjectPublishRejectedNotifyProcessor";

/**
 * Outbox 周りの DI 集約 (#187 PR2 review MEDIUM 1 対応)
 *
 * apps/web と apps/admin の `lib/di/outbox.ts` がほぼ完全に重複していたため
 * (factory 関数が両者で同一)、infrastructure 層に集約する。
 *
 * 各 app は env を読む役割を担わず、本モジュールの factory を呼ぶだけにする。
 * env の読み取り自体もここに集約 (process.env は Node ランタイム前提でどちらの
 * Next.js app からも同じ規約でアクセスされるため)。
 */

// ==================== env 読み取り ====================

/**
 * メール送信用の MailSender を返す。
 *
 * - `RESEND_API_KEY` が設定されていれば ResendMailSender
 * - 未設定なら NoopMailSender (テスト・CI で起動可能にするため)
 */
function getMailSender(): MailSender {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.MAIL_FROM ?? "noreply@physifun.com";
  if (!apiKey) {
    return new NoopMailSender();
  }
  return new ResendMailSender({ apiKey, fromAddress });
}

/**
 * メール本文に埋め込むベース URL を返す。
 *
 * 末尾スラッシュは正規化する。未設定だと `/activate?token=...` のような相対 URL に
 * なってしまうため、fail-closed で throw する。
 *
 * 注意: admin app から呼ばれた場合でも **web origin** を返す必要がある
 * (リンク先は web のページ)。
 */
function getAppUrl(): string {
  const value = process.env.APP_URL;
  if (!value) {
    throw new Error(
      "APP_URL is not set. Set it to the canonical web origin (e.g. https://physical-funding-staging.vercel.app)"
    );
  }
  return value.replace(/\/+$/, "");
}

/**
 * 運営宛通知メールの宛先を返す。
 *
 * `ADMIN_EMAIL_LIST` はカンマ区切り (#147 互換) だが、現状の `MailSender.send` は
 * 単一宛先しか取らないため、先頭の 1 件を採用する。
 *
 * Project worker でしか使わないため、LeaderApplication worker のみ作る経路では
 * 評価されない (lazy access)。
 */
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

// ==================== Worker factory ====================

/**
 * LeaderApplicationOutboxMessage 用 Worker を組み立てる。
 *
 * 登録 processor:
 * - ACTIVATION_EMAIL (#119)
 * - approved.notify_applicant (#187)
 * - rejected.notify_applicant (#187)
 *
 * NOTE: ACTIVATION_EMAIL は web の応募フローでしか投函されないが、admin の tick が
 * 該当 PENDING 行を拾った場合に dead-letter 化されるのを防ぐため両 app で登録する。
 */
export function buildLeaderApplicationOutboxWorker(
  prisma: PrismaClient,
  options?: OutboxWorkerOptions
): OutboxWorker {
  const mailSender = getMailSender();
  const appUrl = getAppUrl();
  const accountEmailLookup = new PrismaAccountEmailLookup(prisma);

  return new OutboxWorker(
    prisma,
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
 * 登録 processor:
 * - admin_publish_request.notify
 * - project_publish_approved.notify
 * - project_publish_rejected.notify
 * - project_force_unpublished.notify
 */
export function buildProjectOutboxWorker(
  prisma: PrismaClient,
  options?: OutboxWorkerOptions
): ProjectOutboxWorker {
  const mailSender = getMailSender();
  const appUrl = getAppUrl();
  const accountEmailLookup = new PrismaAccountEmailLookup(prisma);

  return new ProjectOutboxWorker(
    prisma,
    [
      new AdminPublishRequestNotifyProcessor(mailSender, getAdminNotificationEmail(), appUrl),
      new ProjectPublishApprovedNotifyProcessor(mailSender, accountEmailLookup, appUrl),
      new ProjectPublishRejectedNotifyProcessor(mailSender, accountEmailLookup, appUrl),
      new ProjectForceUnpublishedNotifyProcessor(mailSender, accountEmailLookup, appUrl),
    ],
    options
  );
}
