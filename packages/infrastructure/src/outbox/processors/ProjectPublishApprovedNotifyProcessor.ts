import { ok, err, type Result } from "@physifun/domain";
import { PROJECT_PUBLISH_APPROVED_NOTIFY_TYPE } from "@physifun/application";
import type { MailSender } from "../../mail/types";
import type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "../types";
import { escapeHtml } from "./escapeHtml";
import type { AccountEmailLookup } from "./types";

/** payload 型 */
export interface ProjectPublishApprovedPayload {
  readonly projectId: string;
  readonly projectTitle: string;
  readonly leaderAccountId: string;
  readonly reviewerId: string;
  readonly approvedAt: string;
}

export { PROJECT_PUBLISH_APPROVED_NOTIFY_TYPE };

/**
 * リーダー向けプロジェクト承認通知メールを送信する OutboxProcessor。
 *
 * 運営がプロジェクトを承認した際にリーダーへ「プロジェクトが公開されました」旨を通知する。
 */
export class ProjectPublishApprovedNotifyProcessor implements OutboxProcessor<ProjectPublishApprovedPayload> {
  readonly type = PROJECT_PUBLISH_APPROVED_NOTIFY_TYPE;

  constructor(
    private readonly mailSender: MailSender,
    private readonly accountEmailLookup: AccountEmailLookup,
    private readonly baseUrl: string
  ) {}

  async process(
    message: OutboxMessage<ProjectPublishApprovedPayload>
  ): Promise<Result<void, OutboxProcessError>> {
    const { projectId, projectTitle, leaderAccountId } = message.payload;

    const email = await this.accountEmailLookup.findEmailByAccountId(leaderAccountId);
    if (!email) {
      return err({
        message: `リーダーのメールアドレスが見つかりません: accountId=${leaderAccountId}`,
        retriable: false,
      });
    }

    const projectUrl = `${this.baseUrl}/my/projects/${projectId}`;

    // TODO: A-4 で正式テンプレートに差し替え
    const safeTitle = projectTitle.replace(/[\r\n\t]/g, " ");
    const subject = `【PhysiFun】プロジェクトが公開されました: ${safeTitle}`;
    const text = [
      "プロジェクトが承認され、公開されました。",
      "",
      `プロジェクト名: ${projectTitle}`,
      "",
      "以下のリンクからプロジェクトを確認できます。",
      projectUrl,
      "",
      "---",
      "PhysiFun 運営チーム",
    ].join("\n");

    const html = [
      "<p>プロジェクトが承認され、公開されました。</p>",
      `<p><strong>プロジェクト名:</strong> ${escapeHtml(projectTitle)}</p>`,
      `<p><a href="${escapeHtml(projectUrl)}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;">プロジェクトを確認する</a></p>`,
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
