import { Resend } from "resend";
import { ok, err, type Result } from "@physifun/domain";
import type { MailMessage, MailSender, MailSendError } from "./types";

/**
 * Resend SDK を使ったメール送信アダプタ。
 *
 * 環境変数:
 * - RESEND_API_KEY (必須)
 * - MAIL_FROM (任意: デフォルト noreply@physifun.com)
 */
export class ResendMailSender implements MailSender {
  private readonly client: Resend;
  private readonly fromAddress: string;

  constructor(config: { apiKey: string; fromAddress: string }) {
    this.client = new Resend(config.apiKey);
    this.fromAddress = config.fromAddress;
  }

  async send(message: MailMessage): Promise<Result<void, MailSendError>> {
    try {
      const { error } = await this.client.emails.send({
        from: this.fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      if (error) {
        // Resend のエラーレスポンスを判定
        const retriable = isRetriableResendError(error);
        return err({
          message: error.message,
          retriable,
          cause: error,
        });
      }

      return ok(undefined);
    } catch (cause: unknown) {
      // ネットワーク障害などの例外は一時障害扱い
      return err({
        message:
          cause instanceof Error ? cause.message : "Unknown error occurred",
        retriable: true,
        cause,
      });
    }
  }
}

/**
 * Resend のエラーがリトライ可能かどうかを判定する。
 * 429 (rate limit) や 5xx 系は retriable、4xx 系は永続的失敗。
 */
function isRetriableResendError(error: { name: string; message: string }): boolean {
  const name = error.name.toLowerCase();
  // Resend SDK のエラー名で判定
  if (name.includes("rate_limit") || name.includes("too_many_requests")) {
    return true;
  }
  if (name.includes("internal_server_error") || name.includes("service_unavailable")) {
    return true;
  }
  // それ以外 (validation_error, not_found 等) は永続的失敗
  return false;
}
