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
  /**
   * 承認時に自動生成された Project の ID（Issue #192 PR5）。
   *
   * 通知メールの CTA URL に `/my/projects/${projectId}` として埋め込む。
   * 旧 payload との後方互換性のためオプショナルだが、新規メッセージでは常に含まれる。
   */
  readonly projectId?: string;
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
    const { email, projectId } = message.payload;

    // Issue #192 PR5: projectId があれば新規プロジェクト詳細へ直接遷移する CTA、
    // 無い場合は後方互換でログイン画面へのリンクを採用する。
    const ctaUrl = projectId ? `${this.baseUrl}/my/projects/${projectId}` : `${this.baseUrl}/login`;
    const ctaLabel = projectId ? "プロジェクトを確認する" : "ログインする";

    const subject = "【PhysiFun】リーダー応募が承認されました";
    const text = [
      "PhysiFun へのリーダー応募が承認されました。",
      "",
      "リーダーとしてプロジェクトを作成・運営できるようになりました。",
      projectId
        ? "応募内容を引き継いだプロジェクトの下書きが用意されています。以下のリンクから内容を確認・編集できます。"
        : "以下のリンクからログインしてください。",
      "",
      ctaUrl,
      "",
      "---",
      "PhysiFun 運営チーム",
    ].join("\n");

    const html = [
      "<p>PhysiFun へのリーダー応募が承認されました。</p>",
      "<p>リーダーとしてプロジェクトを作成・運営できるようになりました。</p>",
      projectId
        ? "<p>応募内容を引き継いだプロジェクトの下書きが用意されています。以下のリンクから内容を確認・編集できます。</p>"
        : "",
      `<p><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;">${escapeHtml(ctaLabel)}</a></p>`,
      "<hr>",
      "<p>PhysiFun 運営チーム</p>",
    ]
      .filter((line) => line !== "")
      .join("\n");

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
