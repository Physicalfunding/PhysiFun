import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getAuthenticateAdapter, getBcryptPasswordHasher } from "./di/auth";

/**
 * ユーザーが存在しない / passwordHash が無い場合のタイミング攻撃対策用ダミーハッシュ。
 *
 * bcrypt.compare を必ず 1 回実行することで、存在しないユーザーと
 * パスワード不一致の応答時間差をなくす。
 * 値は固定で問題ない（実在パスワードにマッチしない前提）。
 */
const DUMMY_BCRYPT_HASH = "$2b$10$xayTtqBxF8k.DEBoqEFA0O6QFFGFVLTB.sp4jrtA7KCnVKkvlcRFa";

/**
 * NextAuth.js 設定（apps/web）
 *
 * Credentials プロバイダーでメール + パスワード認証を行う。
 * ACTIVE かつ passwordHash を持つアカウントのみログイン可能。
 *
 * @see https://next-auth.js.org/configuration/options
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

        const adapter = getAuthenticateAdapter();
        const hasher = getBcryptPasswordHasher();

        // Account.email は登録時に trim + toLowerCase で正規化しているため、
        // ログイン側も同じ正規化を行わないと大文字小文字差でログイン不能になる
        const normalizedEmail = credentials.email.trim().toLowerCase();
        const account = await adapter.findActiveAccountByEmail(normalizedEmail);

        // タイミング攻撃対策: アカウントが無い場合もダミーハッシュで compare を実行して
        // レスポンスタイムを均一化する
        const hashToCompare = account?.passwordHash ?? DUMMY_BCRYPT_HASH;
        const passwordOk = await hasher.compare(credentials.password, hashToCompare);

        if (!account || !passwordOk) {
          return null;
        }

        return {
          id: account.id,
          email: account.email,
        };
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
      }
      return session;
    },
  },
};
