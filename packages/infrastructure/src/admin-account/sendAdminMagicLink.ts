import type { SendVerificationRequestParams } from "next-auth/providers/email";
import type { MailSender } from "../mail/types";

/**
 * NextAuth EmailProvider 用マジックリンク送信関数 (#145)
 *
 * apps/admin 側の auth.ts が EmailProvider の `sendVerificationRequest` として
 * このファクトリを呼び出す。nodemailer を使わず、既存の `MailSender`
 * (ResendMailSender) 経由で送信することで依存を最小化する。
 *
 * - 送信先は `email` (AdminAccount.email と一致するはず) 単一
 * - 件名 / 本文は日本語固定 (運営管理アプリのみが利用)
 * - マジックリンクの URL は NextAuth が params.url で組み立て済み
 */
export function createSendAdminMagicLink(deps: { mailSender: MailSender }) {
  return async function sendAdminMagicLink(params: SendVerificationRequestParams): Promise<void> {
    const { identifier: email, url, expires } = params;

    // NEXTAUTH_URL が誤設定/悪意ある値になった場合に javascript: / data: などの
    // 危険スキームをメール本文に載せないための保険 (#157 H1)。
    // NextAuth 本体も通常は http(s) URL を生成するが、自衛のため明示的に検査する。
    assertHttpUrl(url);

    const expiresJst = formatJstDateTime(expires);

    const subject = "【PhysiFun 運営管理】ログイン用リンク";
    const text = [
      "PhysiFun 運営管理アプリのログインリンクです。",
      "",
      "下記 URL を 10 分以内にブラウザで開いてください:",
      url,
      "",
      `このリンクは ${expiresJst} まで有効です。`,
      "心当たりがない場合は、このメールは破棄してください。",
      "",
      "— PhysiFun 運営",
    ].join("\n");

    const html = [
      "<p>PhysiFun 運営管理アプリのログインリンクです。</p>",
      "<p>下記ボタンを 10 分以内にクリックしてください:</p>",
      `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:4px;">ログインする</a></p>`,
      `<p>うまく動作しない場合は以下の URL をブラウザに貼り付けてください:<br><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
      `<p style="color:#6b7280;font-size:12px;">このリンクは ${escapeHtml(expiresJst)} まで有効です。心当たりがない場合は破棄してください。</p>`,
      "<p style=\"color:#6b7280;font-size:12px;\">— PhysiFun 運営</p>",
    ].join("\n");

    const result = await deps.mailSender.send({
      to: email,
      subject,
      text,
      html,
    });

    if (!result.ok) {
      // NextAuth は throw されたエラーをログに出し signIn は `?error=EmailSignin` で戻す。
      throw new Error(`[sendAdminMagicLink] mail send failed: ${result.error.message}`);
    }
  };
}

/**
 * マジックリンク URL が http:// または https:// で始まる安全な URL であることを検証する。
 * それ以外 (javascript:, data:, vbscript: など) は即 throw。
 *
 * URL パース自体が失敗するケース (相対パス、空文字列) も弾く。
 */
function assertHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[sendAdminMagicLink] invalid magic link URL (not a URL)`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `[sendAdminMagicLink] disallowed URL scheme: ${parsed.protocol} (http/https only)`
    );
  }
}

function formatJstDateTime(date: Date): string {
  // JST 固定表示 (運営管理アプリは日本国内運用)
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm} JST`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
