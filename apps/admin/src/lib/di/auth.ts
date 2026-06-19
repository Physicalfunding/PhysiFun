import {
  NoopMailSender,
  ResendMailSender,
  createSendAdminMagicLink,
  getAdminMagicLinkHmacSecret,
  type MailSender,
} from "@physifun/infrastructure";
import {
  createAdminKyselyAdapter,
  isActiveAdminByEmail,
} from "@physifun/infrastructure/src/kysely";
import { EMAIL_MAGIC_LINK_MAX_AGE_MIN } from "../auth-constants";

/**
 * 運営管理アプリの認証まわりの DI ヘルパー (#145)
 *
 * - Admin 認証 Adapter: NextAuth v4 Database 戦略のカスタム Adapter
 * - MailSender: Resend がある環境では ResendMailSender、無ければ NoopMailSender
 *   (開発時 / テスト時にメール送信基盤無しでも起動できるようにするため)
 * - sendAdminMagicLink: EmailProvider の sendVerificationRequest に差し込む関数
 * - isActiveAdminByEmail: NextAuth `callbacks.signIn` で「未登録メールへのマジックリンク
 *   送信」を拒否するためのチェック (#157 C1)
 *
 * 規約 (#119): モジュールレベル new を避け、都度関数呼び出しで生成する。
 */

/**
 * NextAuth v4 Database 戦略のカスタム Adapter を返す。
 *
 * #225 で Prisma 実装（createAdminPrismaAdapter）から Kysely 実装（createAdminKyselyAdapter）へ
 * 差し替え済み。関数名 `getAdminPrismaAdapter` は auth.ts と既存ユニットテスト（auth-cookies）の
 * モックが参照しているため互換維持で据え置く（最終的な改名は Prisma 撤去 #230 で実施）。
 */
export function getAdminPrismaAdapter() {
  return createAdminKyselyAdapter();
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
  // #159 M-4 拡張: メール本文の「N 分以内に〜」を UI/NextAuth と同じ定数から駆動
  // #146: URL に HMAC-SHA256 署名を付けるため secret を DI で渡す (未設定時は throw)
  return createSendAdminMagicLink({
    mailSender: getAdminMailSender(),
    expiresInMin: EMAIL_MAGIC_LINK_MAX_AGE_MIN,
    hmacSecret: getAdminMagicLinkHmacSecret(),
  });
}

export function getIsActiveAdminByEmail() {
  return isActiveAdminByEmail;
}
