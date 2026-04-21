import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { getAdminPrismaAdapter, getIsActiveAdminByEmail, getSendAdminMagicLink } from "./di/auth";
import { checkAdminMagicLinkRateLimit } from "./rateLimit";
import { EMAIL_MAGIC_LINK_MAX_AGE_SEC } from "./auth-constants";

/**
 * 運営管理アプリ用 NextAuth.js 設定 (#145 / #157)
 *
 * 認証方式: Magic Link (EmailProvider) + Database セッション戦略
 *
 * - AdminAccount テーブルから ACTIVE なアカウントのみをログイン許可 (AdminPrismaAdapter 内で制御)。
 * - マジックリンク送信は Resend 経由 (sendVerificationRequest で差し込み)。
 * - 既知の email のみログイン可能。createUser は adapter 側で throw する。
 * - セッション TTL = 3600s (1h)。DB 側 (admin_sessions) の expires と一致。
 * - AdminSession 行を DELETE すれば即座に強制 revoke される (deleteSession / getSessionAndUser)。
 *
 * ## 開放リレー対策 (#157 C1)
 * NextAuth v4 EmailProvider は `getUserByEmail` が null でも合成ユーザを作って
 * `sendVerificationRequest` まで流すため、`callbacks.signIn` で AdminAccount 実在 +
 * ACTIVE をチェックし、未登録 email への送信を遮断する。また `adminMagicLink` アクションの
 * レート制限 (5 回 / 15 分 / email) で同一 email への連投も抑止する。
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
      // ⚠️ server / from は実際には使われない。
      // NextAuth の EmailProvider は本来 nodemailer を使って SMTP 送信するが、
      // ここでは `sendVerificationRequest` を明示指定しているため nodemailer は
      // 初期化されず、送信は ResendMailSender 経由に差し替わる。
      // ただし EmailProvider のスキーマ上 server / from が必須 (undefined 不可) なので
      // 形だけ満たすためのダミー値を入れている。誤って SMTP を叩こうとしても
      // host:"unused" で解決不能になり実害は無いが、変更時は意図を誤解しないこと。
      server: { host: "unused", port: 0, auth: { user: "unused", pass: "unused" } },
      from: process.env.MAIL_FROM ?? "noreply@physifun.com",
      maxAge: EMAIL_MAGIC_LINK_MAX_AGE_SEC, // #158 M4: verify-request UI と同じ定数を参照
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
    /**
     * signIn callback (#157 C1 / H1 / #158 L1)
     *
     * Magic Link 送信フロー (`email.verificationRequest === true`) のときのみ:
     *   1. レート制限 (email 単位 5/15min) を消費。超過なら false を返して送信中断
     *   2. `user` が NextAuth の合成ユーザ (getUserByEmail が null -> {id: email, email} に
     *      フォールバック) であれば false を返して送信遮断
     *   3. 念のため isActiveAdminByEmail で再チェック (二重防御)
     *
     * false を返すと NextAuth は AccessDenied を投げ、`createVerificationToken` /
     * `sendVerificationRequest` はいずれも実行されない。エラーは pages.error (/login)
     * にリダイレクトされるため、クライアントからは「メール送信失敗」の表示になる。
     *
     * ## 2 回クエリする理由 (#158 L1)
     * NextAuth は内部で `adapter.getUserByEmail` を呼んだ後に signIn callback を呼ぶため、
     * isActiveAdminByEmail を追加するとクエリが 2 回走る構図になる。これは意図的:
     * - 合成ユーザ判定 (`user.id === address`) を高速パスとして手前に置き、
     *   未登録/DISABLED email は 2 回目のクエリ前に弾く
     * - 2 回目 (isActiveAdminByEmail) は adapter 実装と signIn callback が別ファイルに
     *   なっていることに対する防御的チェック。片方を変更しても security invariant を
     *   保つため残す (adapter がリグレッションで非 ACTIVE を返しても signIn で救える)
     *
     * 非 verificationRequest 経路 (= マジックリンククリック後のコールバック等) は
     * adapter.getUserByEmail が ACTIVE のみを返す仕様と合わさって弾かれるため、
     * ここでは true を返す。
     */
    async signIn({ user, email }) {
      if (!email?.verificationRequest) {
        return true;
      }
      const rawAddress = user.email;
      if (!rawAddress) {
        return false;
      }
      // 大文字違い (e.g. "Alice@Example.com" vs "alice@example.com") でレート制限を
      // バイパスされないよう正規化する (#157 H3)。AdminAccount.email は seed 時点で
      // 小文字で保存しているので DB 検索も同じ正規化形でマッチする。
      const address = rawAddress.trim().toLowerCase();
      if (!address) {
        return false;
      }

      const rate = checkAdminMagicLinkRateLimit(address);
      if (!rate.ok) {
        // AccessDenied にフォールバック。クライアントは EmailSignin エラーを受け取る。
        return false;
      }

      // 高速パス: NextAuth が getUserByEmail=null のときに作る合成ユーザは
      // `id === email` となる。DB 由来の AdminAccount は id が UUID なので、
      // この等価で合成 / 実 AdminAccount を区別できる (#158 L1)。
      if (user.id === address || user.id === rawAddress) {
        return false;
      }

      // 二重防御: adapter/getUserByEmail が壊れた場合でも非 ACTIVE は弾く。
      const isAdmin = await getIsActiveAdminByEmail()(address);
      if (!isAdmin) {
        return false;
      }
      return true;
    },

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
