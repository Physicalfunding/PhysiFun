import { NoopMailSender } from "../mail/NoopMailSender";
import { ResendMailSender } from "../mail/ResendMailSender";
import type { MailSender } from "../mail/types";

/**
 * Outbox composition で使う env 読み取りヘルパー（#226 で composition.ts から分離）。
 *
 * DB クライアントへの依存を持たない純粋な env アクセスのみを集約し、Prisma 版 / Kysely 版
 * 双方の composition から共有できるようにする。
 */

/**
 * メール送信用の MailSender を返す。
 * - `RESEND_API_KEY` が設定されていれば ResendMailSender、未設定なら NoopMailSender。
 */
export function getMailSender(): MailSender {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.MAIL_FROM ?? "noreply@physifun.com";
  if (!apiKey) {
    return new NoopMailSender();
  }
  return new ResendMailSender({ apiKey, fromAddress });
}

/**
 * メール本文に埋め込むベース URL を返す（末尾スラッシュ正規化、未設定なら fail-closed）。
 * admin app から呼ばれた場合でも **web origin** を指す必要がある。
 */
export function getAppUrl(): string {
  const value = process.env.APP_URL;
  if (!value) {
    throw new Error(
      "APP_URL is not set. Set it to the canonical web origin (e.g. https://physical-funding-staging.vercel.app)"
    );
  }
  return value.replace(/\/+$/, "");
}

/**
 * 運営宛通知メールの宛先（`ADMIN_EMAIL_LIST` カンマ区切りの先頭 1 件）を返す。
 * Project worker でのみ使うため、LeaderApplication worker 経路では評価されない。
 */
export function getAdminNotificationEmail(): string {
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
