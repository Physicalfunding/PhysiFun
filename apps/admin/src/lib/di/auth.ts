import {
  NoopMailSender,
  ResendMailSender,
  createAdminPrismaAdapter,
  createSendAdminMagicLink,
  isActiveAdminByEmail,
  type MailSender,
} from "@physifun/infrastructure";

/**
 * 運営管理アプリの認証まわりの DI ヘルパー (#145)
 *
 * - AdminPrismaAdapter: NextAuth v4 Database 戦略のカスタム Adapter
 * - MailSender: Resend がある環境では ResendMailSender、無ければ NoopMailSender
 *   (開発時 / テスト時にメール送信基盤無しでも起動できるようにするため)
 * - sendAdminMagicLink: EmailProvider の sendVerificationRequest に差し込む関数
 * - isActiveAdminByEmail: NextAuth `callbacks.signIn` で「未登録メールへのマジックリンク
 *   送信」を拒否するためのチェック (#157 C1)
 *
 * 規約 (#119): モジュールレベル new を避け、都度関数呼び出しで生成する。
 */
export function getAdminPrismaAdapter() {
  return createAdminPrismaAdapter();
}

export function getAdminMailSender(): MailSender {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.MAIL_FROM ?? "noreply@physifun.com";
  if (!apiKey) {
    // 開発環境 / CI でキーが未設定の場合は Noop にフォールバック。
    return new NoopMailSender();
  }
  return new ResendMailSender({ apiKey, fromAddress });
}

export function getSendAdminMagicLink() {
  return createSendAdminMagicLink({ mailSender: getAdminMailSender() });
}

export function getIsActiveAdminByEmail() {
  return isActiveAdminByEmail;
}
