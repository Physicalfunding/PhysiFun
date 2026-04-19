import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getAuthenticateAdapter, getBcryptPasswordHasher } from "./di/auth";

/**
 * ユーザーが存在しない / passwordHash が無い場合のタイミング攻撃対策用ダミーハッシュ。
 *
 * bcrypt.compare を必ず 1 回実行することで、存在しないユーザーと
 * パスワード不一致の応答時間差をなくす。
 */
const DUMMY_BCRYPT_HASH = "$2b$10$xayTtqBxF8k.DEBoqEFA0O6QFFGFVLTB.sp4jrtA7KCnVKkvlcRFa";

/**
 * 運営管理アプリ用 NextAuth.js 設定
 *
 * Credentials プロバイダーでメール + パスワード認証を行い、
 * ADMIN ロールを持つ Account のみログインを許可する。
 *
 * 1. Prisma で Account を取得（ACTIVE かつ passwordHash あり）
 * 2. bcrypt でパスワード検証
 * 3. roles に ADMIN が含まれるか確認
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

        // タイミング攻撃対策: アカウントが無い場合もダミーハッシュで compare を実行
        const hashToCompare = account?.passwordHash ?? DUMMY_BCRYPT_HASH;
        const passwordOk = await hasher.compare(credentials.password, hashToCompare);

        if (!account || !passwordOk) {
          return null;
        }

        // ADMIN ロール検証: ADMIN が含まれない場合はログイン拒否
        if (!account.roles.includes("ADMIN")) {
          return null;
        }

        return {
          id: account.id,
          email: account.email,
          roles: [...account.roles],
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
