import { ok, err, type Result } from "@physifun/domain";
import type { MailSender } from "../../mail/types";
import type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "../types";

/** ACTIVATION_EMAIL メッセージの payload 型 */
export interface ActivationEmailPayload {
  readonly accountId: string;
  readonly email: string;
  readonly displayName: string;
  readonly activationToken: string;
}

/** メッセージ種別定数 */
export const ACTIVATION_EMAIL_TYPE = "ACTIVATION_EMAIL" as const;

/**
 * アカウント有効化メールを送信する OutboxProcessor。
 *
 * payload から宛先・トークンを取り出し、有効化 URL を含むメールを送信する。
 */
export class ActivationEmailProcessor
  implements OutboxProcessor<ActivationEmailPayload>
{
  readonly type = ACTIVATION_EMAIL_TYPE;

  constructor(
    private readonly mailSender: MailSender,
    private readonly baseUrl: string,
  ) {}

  async process(
    message: OutboxMessage<ActivationEmailPayload>,
  ): Promise<Result<void, OutboxProcessError>> {
    const { email, displayName, activationToken } = message.payload;

    const activationUrl = `${this.baseUrl}/activate?token=${activationToken}`;

    // TODO: A-4 で正式テンプレートに差し替え
    const subject = "【PhysiFun】アカウント有効化のお願い";
    const text = [
      `${displayName} さん`,
      "",
      "PhysiFun へのリーダー応募ありがとうございます。",
      "以下のリンクをクリックしてアカウントを有効化してください。",
      "",
      activationUrl,
      "",
      "このリンクの有効期限は 24 時間です。",
      "心当たりがない場合はこのメールを無視してください。",
      "",
      "---",
      "PhysiFun 運営チーム",
    ].join("\n");

    const html = [
      `<p>${displayName} さん</p>`,
      "<p>PhysiFun へのリーダー応募ありがとうございます。</p>",
      "<p>以下のボタンをクリックしてアカウントを有効化してください。</p>",
      `<p><a href="${activationUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">アカウントを有効化する</a></p>`,
      "<p>ボタンが機能しない場合は、以下の URL をブラウザに貼り付けてください。</p>",
      `<p>${activationUrl}</p>`,
      "<p>このリンクの有効期限は 24 時間です。</p>",
      "<p>心当たりがない場合はこのメールを無視してください。</p>",
      "<hr>",
      "<p>PhysiFun 運営チーム</p>",
    ].join("\n");

    const result = await this.mailSender.send({
      to: email,
      subject,
      text,
      html,
    });

    if (!result.ok) {
      return err({
        message: result.error.message,
        retriable: result.error.retriable,
        cause: result.error.cause,
      });
    }

    return ok(undefined);
  }
}
