import { ok, err, type Result } from "@physifun/domain";
import { LEADER_APPLICATION_REJECTED_NOTIFY_TYPE } from "@physifun/application";
import type { MailSender } from "../../mail/types";
import type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "../types";
import type { AccountEmailLookup } from "./types";
import { escapeHtml } from "./escapeHtml";

/** payload 型 (RejectLeaderApplicationUseCase が書き込む) */
export interface LeaderApplicationRejectedNotifyPayload {
  readonly applicationId: string;
  readonly accountId: string;
  readonly reviewerNote: string;
}

export { LEADER_APPLICATION_REJECTED_NOTIFY_TYPE };

/**
 * リーダー応募却下通知メールを送信する OutboxProcessor (#187 PR2)。
 *
 * 運営がリーダー応募を却下した際に、応募者に却下理由を通知する。
 * payload には email が含まれないため AccountEmailLookup で accountId → email を解決する。
 */
export class LeaderApplicationRejectedNotifyProcessor implements OutboxProcessor<LeaderApplicationRejectedNotifyPayload> {
  readonly type = LEADER_APPLICATION_REJECTED_NOTIFY_TYPE;

  constructor(
    private readonly mailSender: MailSender,
    private readonly accountEmailLookup: AccountEmailLookup
  ) {}

  async process(
    message: OutboxMessage<LeaderApplicationRejectedNotifyPayload>
  ): Promise<Result<void, OutboxProcessError>> {
    const { accountId, reviewerNote } = message.payload;

    const email = await this.accountEmailLookup.findEmailByAccountId(accountId);
    if (!email) {
      return err({
        message: `応募者のメールアドレスが見つかりません: accountId=${accountId}`,
        retriable: false,
      });
    }

    const subject = "【PhysiFun】リーダー応募について";
    const text = [
      "PhysiFun へのリーダー応募について、慎重に検討した結果、今回は見送らせていただくことになりました。",
      "",
      "理由:",
      reviewerNote,
      "",
      "ご応募いただきありがとうございました。",
      "",
      "---",
      "PhysiFun 運営チーム",
    ].join("\n");

    const html = [
      "<p>PhysiFun へのリーダー応募について、慎重に検討した結果、今回は見送らせていただくことになりました。</p>",
      "<p><strong>理由:</strong></p>",
      `<p style="padding:12px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">${escapeHtml(reviewerNote)}</p>`,
      "<p>ご応募いただきありがとうございました。</p>",
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
