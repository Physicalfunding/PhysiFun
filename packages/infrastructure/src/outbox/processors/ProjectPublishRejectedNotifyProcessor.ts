import { ok, err, type Result } from "@physifun/domain";
import type { MailSender } from "../../mail/types";
import type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "../types";
import type { AccountEmailLookup } from "./types";

/** payload 型 */
export interface ProjectPublishRejectedPayload {
  readonly projectId: string;
  readonly projectTitle: string;
  readonly leaderAccountId: string;
  readonly reviewerId: string;
  readonly reviewerNote: string;
  readonly rejectedAt: string;
}

/** メッセージ種別定数 (UseCase 側と一致させる) */
export const LEADER_PUBLISH_REJECTED_NOTIFY_TYPE = "project_publish_rejected.notify";

/**
 * リーダー向けプロジェクト差戻通知メールを送信する OutboxProcessor。
 *
 * 運営がプロジェクト公開申請を差戻した際にリーダーへ通知する。差戻理由を本文に含む。
 */
export class ProjectPublishRejectedNotifyProcessor
  implements OutboxProcessor<ProjectPublishRejectedPayload>
{
  readonly type = LEADER_PUBLISH_REJECTED_NOTIFY_TYPE;

  constructor(
    private readonly mailSender: MailSender,
    private readonly accountEmailLookup: AccountEmailLookup,
    private readonly baseUrl: string
  ) {}

  async process(
    message: OutboxMessage<ProjectPublishRejectedPayload>
  ): Promise<Result<void, OutboxProcessError>> {
    const { projectId, projectTitle, leaderAccountId, reviewerNote } = message.payload;

    const email = await this.accountEmailLookup.findEmailByAccountId(leaderAccountId);
    if (!email) {
      return err({
        message: `リーダーのメールアドレスが見つかりません: accountId=${leaderAccountId}`,
        retriable: false,
      });
    }

    const editUrl = `${this.baseUrl}/my/projects/${projectId}/edit`;

    // TODO: A-4 で正式テンプレートに差し替え
    const subject = `【PhysiFun】プロジェクト公開申請が差し戻されました: ${projectTitle}`;
    const text = [
      "プロジェクトの公開申請が差し戻されました。",
      "",
      `プロジェクト名: ${projectTitle}`,
      "",
      "差戻理由:",
      reviewerNote,
      "",
      "内容を修正して、再度公開申請してください。",
      editUrl,
      "",
      "---",
      "PhysiFun 運営チーム",
    ].join("\n");

    const html = [
      "<p>プロジェクトの公開申請が差し戻されました。</p>",
      `<p><strong>プロジェクト名:</strong> ${projectTitle}</p>`,
      "<p><strong>差戻理由:</strong></p>",
      `<p style="padding:12px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">${reviewerNote}</p>`,
      "<p>内容を修正して、再度公開申請してください。</p>",
      `<p><a href="${editUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">プロジェクトを編集する</a></p>`,
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
