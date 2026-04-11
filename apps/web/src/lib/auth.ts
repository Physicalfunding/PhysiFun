import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/**
 * NextAuth.js 設定（Phase 1 移行中の暫定スタブ）
 *
 * 旧 User エンティティ / PrismaUserRepository は Issue #55 で削除された。
 * 正式なログイン処理は Issue #61（Account アクティベーション / ログイン復活）で再構築する。
 * 現時点では `authorize` が常に null を返し、ログインは必ず失敗する。
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
      // Phase 1 移行中: Account ベースの認証実装が入るまでは常にログイン失敗
      async authorize() {
        return null;
      },
    }),
  ],

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
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
