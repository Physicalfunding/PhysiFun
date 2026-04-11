import { Resend } from "resend";

/**
 * メール通知に必要なデータ
 */
export interface EntryNotificationData {
  name: string;
  email: string;
  projectTitle: string;
  projectSummary: string;
  projectStory: string;
}

/**
 * メール通知サービスのインターフェース
 * application層から利用するため、インターフェースを分離
 */
export interface EmailNotificationService {
  notifyNewEntry(data: EntryNotificationData): Promise<void>;
}

/**
 * Resend を使ったメール通知サービス
 */
export class ResendEmailNotificationService implements EmailNotificationService {
  private readonly resend: Resend;
  private readonly adminEmails: string[];
  private readonly fromAddress: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY が設定されていません");
    }

    this.resend = new Resend(apiKey);

    const emailList = process.env.ADMIN_EMAIL_LIST;
    if (!emailList) {
      throw new Error("ADMIN_EMAIL_LIST が設定されていません");
    }
    this.adminEmails = emailList
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (this.adminEmails.length === 0) {
      throw new Error("ADMIN_EMAIL_LIST に有効なメールアドレスがありません");
    }

    this.fromAddress = process.env.EMAIL_FROM_ADDRESS ?? "noreply@resend.dev";
  }

  async notifyNewEntry(data: EntryNotificationData): Promise<void> {
    const subject = `【新規応募】${data.projectTitle} - ${data.name}`;

    const html = `
      <h2>新しいオーナー応募がありました</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 150px;">応募者名</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(data.name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">メールアドレス</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(data.email)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">プロジェクトタイトル</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(data.projectTitle)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">プロジェクト概要</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(data.projectSummary)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">プロジェクト説明</td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${escapeHtml(data.projectStory)}</td>
        </tr>
      </table>
    `;

    await this.resend.emails.send({
      from: this.fromAddress,
      to: this.adminEmails,
      subject,
      html,
    });
  }
}

/**
 * HTMLエスケープ
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
