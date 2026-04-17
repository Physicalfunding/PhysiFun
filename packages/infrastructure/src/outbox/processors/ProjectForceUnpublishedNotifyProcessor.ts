import { ok, err, type Result } from "@physifun/domain";
import { PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE } from "@physifun/application";
import type { MailSender } from "../../mail/types";
import type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "../types";
import { escapeHtml } from "./escapeHtml";
import type { AccountEmailLookup } from "./types";

/** payload 型 */
export interface ProjectForceUnpublishedPayload {
  readonly projectId: string;
  readonly projectTitle: string;
  readonly leaderAccountId: string;
  readonly reviewerId: string;
  readonly reviewerNote: string;
  readonly unpublishedAt: string;
}

export { PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE };

/**
 * リーダー向け強制非公開通知メールを送信する OutboxProcessor。
 *
 * 運営がプロジェクトを強制非公開にした際にリーダーへ通知する。理由を本文に含む。
 */
export class ProjectForceUnpublishedNotifyProcessor implements OutboxProcessor<ProjectForceUnpublishedPayload> {
  readonly type = PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE;

  constructor(
    private readonly mailSender: MailSender,
    private readonly accountEmailLookup: AccountEmailLookup,
    private readonly baseUrl: string
  ) {}

  async process(
    message: OutboxMessage<ProjectForceUnpublishedPayload>
  ): Promise<Result<void, OutboxProcessError>> {
    const { projectId, projectTitle, leaderAccountId, reviewerNote } = message.payload;

    const email = await this.accountEmailLookup.findEmailByAccountId(leaderAccountId);
    if (!email) {
      return err({
        message: `リーダーのメールアドレスが見つかりません: accountId=${leaderAccountId}`,
        retriable: false,
      });
    }

    const projectUrl = `${this.baseUrl}/my/projects/${projectId}`;

    // TODO: A-4 で正式テンプレートに差し替え
    const safeTitle = projectTitle.replace(/[\r\n]/g, " ");
    const subject = `【PhysiFun】プロジェクトが非公開になりました: ${safeTitle}`;
    const text = [
      "運営によりプロジェクトが非公開になりました。",
      "",
      `プロジェクト名: ${projectTitle}`,
      "",
      "理由:",
      reviewerNote,
      "",
      "ご不明な点がございましたら、運営までお問い合わせください。",
      projectUrl,
      "",
      "---",
      "PhysiFun 運営チーム",
    ].join("\n");

    const html = [
      "<p>運営によりプロジェクトが非公開になりました。</p>",
      `<p><strong>プロジェクト名:</strong> ${escapeHtml(projectTitle)}</p>`,
      "<p><strong>理由:</strong></p>",
      `<p style="padding:12px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">${escapeHtml(reviewerNote)}</p>`,
      "<p>ご不明な点がございましたら、運営までお問い合わせください。</p>",
      `<p><a href="${escapeHtml(projectUrl)}" style="display:inline-block;padding:12px 24px;background:#6b7280;color:#fff;text-decoration:none;border-radius:6px;">プロジェクトを確認する</a></p>`,
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
