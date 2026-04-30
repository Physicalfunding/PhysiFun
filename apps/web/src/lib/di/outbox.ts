import {
  ActivationEmailProcessor,
  NoopMailSender,
  OutboxWorker,
  ResendMailSender,
  prisma,
  type ActivationEmailPayload,
  type MailSender,
  type OutboxProcessor,
} from "@physifun/infrastructure";

/**
 * Outbox 周りの DI ヘルパー (#187)
 *
 * - `OutboxWorker` (LeaderApplicationOutboxMessage) を組み立てる
 * - メール送信は Resend が利用可能な環境では `ResendMailSender`、無ければ
 *   `NoopMailSender` にフォールバック (テスト・CI で起動できるようにするため)
 *
 * PR1 スコープ:
 *   - `ActivationEmailProcessor` のみ登録
 *   - `approved.notify_applicant` 等の他 type は未登録 → 該当行が DB に既に
 *     ある状態で `tick()` を回すと `OutboxWorkerBase` が dead-letter 化する点に注意
 *     (PR2 で対応する。詳細は Issue #187)
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

/**
 * アクティベーションメールリンクのベース URL を返す。
 *
 * 未設定だと `${baseUrl}/activate?token=...` が "/activate?..." になり、
 * メール本文中で正しいリンクにならないため throw する (fail closed)。
 */
function getAppUrl(): string {
  const value = process.env.APP_URL;
  if (!value) {
    throw new Error(
      "APP_URL is not set. Set it to the canonical web origin (e.g. https://physical-funding-staging.vercel.app)"
    );
  }
  // 末尾スラッシュを正規化して `${baseUrl}/activate` の二重スラッシュを防ぐ
  return value.replace(/\/+$/, "");
}

function getActivationEmailProcessor(): OutboxProcessor<ActivationEmailPayload> {
  return new ActivationEmailProcessor(getMailSender(), getAppUrl());
}

/**
 * LeaderApplicationOutboxMessage 用の Worker を返す。
 *
 * cron route と inline trigger (`after()`) の両方から利用される。
 */
export function getLeaderApplicationOutboxWorker(): OutboxWorker {
  return new OutboxWorker(prisma, [getActivationEmailProcessor()]);
}
