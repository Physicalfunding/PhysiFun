import { ok, err, type Result } from "@physifun/domain";
import type { MailSender } from "../../mail/types";
import type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "../types";
import { escapeHtml } from "./escapeHtml";

/** payload 型 */
export interface AdminPublishRequestNotifyPayload {
  readonly projectId: string;
  readonly projectTitle: string;
  readonly leaderAccountId: string;
  readonly requestedAt: string;
}

/** メッセージ種別定数 (UseCase 側と一致させる) */
export const ADMIN_PUBLISH_REQUEST_NOTIFY_TYPE = "admin_publish_request.notify";

/**
 * 運営向け公開申請通知メールを送信する OutboxProcessor。
 *
 * リーダーが公開申請した際に運営チームへ「新しい公開申請が届いた」旨を通知する。
 * 宛先は環境変数 `ADMIN_NOTIFICATION_EMAIL` で設定する。
 */
export class AdminPublishRequestNotifyProcessor
  implements OutboxProcessor<AdminPublishRequestNotifyPayload>
{
  readonly type = ADMIN_PUBLISH_REQUEST_NOTIFY_TYPE;

  constructor(
    private readonly mailSender: MailSender,
    private readonly adminEmail: string,
    private readonly baseUrl: string
  ) {}

  async process(
    message: OutboxMessage<AdminPublishRequestNotifyPayload>
  ): Promise<Result<void, OutboxProcessError>> {
    const { projectId, projectTitle, requestedAt } = message.payload;

    const reviewUrl = `${this.baseUrl}/projects/${projectId}`;

    // TODO: A-4 で正式テンプレートに差し替え
    const subject = `【PhysiFun 運営】公開申請: ${projectTitle}`;
    const text = [
      "PhysiFun 運営チーム各位",
      "",
      "新しいプロジェクト公開申請が届きました。",
      "",
      `プロジェクト名: ${projectTitle}`,
      `申請日時: ${requestedAt}`,
      "",
      `以下のリンクから審査してください。`,
      reviewUrl,
      "",
      "---",
      "PhysiFun 自動通知",
    ].join("\n");

    const html = [
      "<p>PhysiFun 運営チーム各位</p>",
      "<p>新しいプロジェクト公開申請が届きました。</p>",
      `<p><strong>プロジェクト名:</strong> ${escapeHtml(projectTitle)}</p>`,
      `<p><strong>申請日時:</strong> ${escapeHtml(requestedAt)}</p>`,
      `<p><a href="${reviewUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">審査する</a></p>`,
      "<hr>",
      "<p>PhysiFun 自動通知</p>",
    ].join("\n");

    const result = await this.mailSender.send({
      to: this.adminEmail,
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
