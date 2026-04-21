import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { getAdminPrismaAdapter, getSendAdminMagicLink } from "./di/auth";

/**
 * 運営管理アプリ用 NextAuth.js 設定 (#145)
 *
 * 認証方式: Magic Link (EmailProvider) + Database セッション戦略
 *
 * - AdminAccount テーブルから ACTIVE なアカウントのみをログイン許可 (AdminPrismaAdapter 内で制御)。
 * - マジックリンク送信は Resend 経由 (sendVerificationRequest で差し込み)。
 * - 既知の email のみログイン可能。createUser は adapter 側で throw する。
 * - セッション TTL = 3600s (1h)。DB 側 (admin_sessions) の expires と一致。
 * - AdminSession 行を DELETE すれば即座に強制 revoke される (deleteSession / getSessionAndUser)。
 *
 * セキュリティ方針 (#140):
 *   - パスワード / TOTP は採用しない (#144 で追加した列は #145 migration で削除済み)。
 *   - 数名の運営のみがアクセスする想定。マジックリンク到達性で本人性を担保。
 *   - 万一トークン漏洩しても AdminSession の強制削除で即座に revoke 可能。
 */
export const authOptions: NextAuthOptions = {
  adapter: getAdminPrismaAdapter(),

  providers: [
    EmailProvider({
      // NextAuth の EmailProvider は nodemailer を要求するが、sendVerificationRequest を
      // 明示指定することで nodemailer 依存を回避して ResendMailSender を使う。
      // server / from は未使用だがスキーマ上必須なのでダミー値を入れる。
      server: { host: "unused", port: 0, auth: { user: "unused", pass: "unused" } },
      from: process.env.MAIL_FROM ?? "noreply@physifun.com",
      maxAge: 10 * 60, // マジックリンクの有効期限 10 分
      async sendVerificationRequest(params) {
        const send = getSendAdminMagicLink();
        await send(params);
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "database",
    maxAge: 60 * 60, // 1h (運営アプリは web より短い)
    updateAge: 10 * 60, // 10 分以上経過時のみ expires を更新 (書き込み量削減)
  },

  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify-request",
    error: "/login",
  },

  callbacks: {
    async session({ session, user }) {
      // Database 戦略では `user` が AdapterUser (= AdminAccount 由来) なので
      // id を session.user.id にコピーする (Route Handler で参照するため)。
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
