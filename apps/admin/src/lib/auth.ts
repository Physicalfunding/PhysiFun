import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getAdminAuthenticateAdapter, getBcryptPasswordHasher } from "./di/auth";

/**
 * アカウントが存在しない / passwordHash が無い場合のタイミング攻撃対策用ダミーハッシュ。
 *
 * bcrypt.compare を必ず 1 回実行することで、存在しないアカウントと
 * パスワード不一致の応答時間差をなくす。
 */
const DUMMY_BCRYPT_HASH = "$2b$10$xayTtqBxF8k.DEBoqEFA0O6QFFGFVLTB.sp4jrtA7KCnVKkvlcRFa";

/**
 * 運営管理アプリ用 NextAuth.js 設定 (#144 Phase 2)
 *
 * Credentials プロバイダーでメール + パスワード認証を行い、
 * ACTIVE な AdminAccount のみログインを許可する。
 *
 * 1. AdminAccount を email で取得（ACTIVE のみ）
 * 2. bcrypt でパスワード検証
 * 3. JWT に adminId と互換用 roles=["ADMIN"] を積む
 *
 * NOTE (#145 / #146):
 *   - middleware / API route / UseCase は現在 `token.roles.includes("ADMIN")` と
 *     `reviewerId` (Account.id 前提) に依存している。Phase 2 完全移行までの
 *     ブリッジとして、JWT.roles に ["ADMIN"] を入れて既存チェックを通す。
 *     UseCase の `findAccountById(reviewerId)` は AdminAccount.id を渡しても
 *     Account テーブルには存在しないため REVIEWER_NOT_FOUND を返し、承認/却下
 *     系操作は #145 の UseCase 改修まで実質無効化される。
 *   - TOTP セットアップ/検証は #146 で後から追加する。
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const adapter = getAdminAuthenticateAdapter();
        const hasher = getBcryptPasswordHasher();

        // AdminAccount.email は seed / 登録時に trim + toLowerCase で正規化しているため、
        // ログイン側も同じ正規化を行わないと大文字小文字差でログイン不能になる
        const normalizedEmail = credentials.email.trim().toLowerCase();
        const admin = await adapter.findActiveAdminAccountByEmail(normalizedEmail);

        // タイミング攻撃対策: アカウントが無い場合もダミーハッシュで compare を実行
        const hashToCompare = admin?.passwordHash ?? DUMMY_BCRYPT_HASH;
        const passwordOk = await hasher.compare(credentials.password, hashToCompare);

        if (!admin || !passwordOk) {
          return null;
        }

        // TODO(#146): totpEnabled=true の場合は TOTP コード検証を経ないとログイン不可にする。
        // 現状は Phase 2 移行直後で TOTP 未セットアップの AdminAccount のみ存在する前提。

        return {
          id: admin.id,
          email: admin.email,
          // 互換: middleware / API route の `roles.includes("ADMIN")` を通すためのブリッジ値 (#145)
          roles: ["ADMIN"],
        };
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 管理画面は 1日 で期限切れ（web より短い）
  },

  jwt: {
    maxAge: 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = user.roles;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.roles = token.roles;
      }
      return session;
    },
  },
};
