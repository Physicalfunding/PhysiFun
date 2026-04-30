import { ok, err, type Result } from "@physifun/domain";
import { LEADER_APPLICATION_APPROVED_NOTIFY_TYPE } from "@physifun/application";
import type { MailSender } from "../../mail/types";
import type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "../types";
import { escapeHtml } from "./escapeHtml";

/** payload 型 (ApproveLeaderApplicationUseCase が書き込む) */
export interface LeaderApplicationApprovedNotifyPayload {
  readonly applicationId: string;
  readonly accountId: string;
  readonly email: string;
}

export { LEADER_APPLICATION_APPROVED_NOTIFY_TYPE };

/**
 * リーダー応募承認通知メールを送信する OutboxProcessor (#187 PR2)。
 *
 * 運営がリーダー応募を承認した際に、応募者に「リーダーとして利用開始できる」旨を通知する。
 * payload に email が含まれているため AccountEmailLookup は不要。
 */
export class LeaderApplicationApprovedNotifyProcessor implements OutboxProcessor<LeaderApplicationApprovedNotifyPayload> {
  readonly type = LEADER_APPLICATION_APPROVED_NOTIFY_TYPE;

  constructor(
    private readonly mailSender: MailSender,
    private readonly baseUrl: string
  ) {}

  async process(
    message: OutboxMessage<LeaderApplicationApprovedNotifyPayload>
  ): Promise<Result<void, OutboxProcessError>> {
    const { email } = message.payload;

    const loginUrl = `${this.baseUrl}/login`;

    const subject = "【PhysiFun】リーダー応募が承認されました";
    const text = [
      "PhysiFun へのリーダー応募が承認されました。",
      "",
      "リーダーとしてプロジェクトを作成・運営できるようになりました。",
      "以下のリンクからログインしてください。",
      "",
      loginUrl,
      "",
      "---",
      "PhysiFun 運営チーム",
    ].join("\n");

    const html = [
      "<p>PhysiFun へのリーダー応募が承認されました。</p>",
      "<p>リーダーとしてプロジェクトを作成・運営できるようになりました。</p>",
      `<p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;">ログインする</a></p>`,
      "<hr>",
      "<p>PhysiFun 運営チーム</p>",
    ].join("\n");

    const result = await this.mailSender.send({ to: email, subject, text, html });

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
