import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/**
 * 運営管理アプリ用 NextAuth.js 設定
 *
 * Credentials プロバイダーでメール + パスワード認証を行い、
 * ADMIN ロールを持つ Account のみログインを許可する。
 *
 * TODO: Account ベース認証が Issue #61 で実装されたら authorize を接続する
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      /**
       * 認証処理
       *
       * 1. Prisma で Account を取得
       * 2. bcrypt でパスワード検証
       * 3. roles に ADMIN が含まれるか確認
       *
       * TODO: infrastructure 層の認証サービスと接続する
       */
      async authorize() {
        // Phase 1 スタブ: Account ベース認証が実装されるまでログイン不可
        return null;
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
        // TODO: roles を token に保存する
        // token.roles = (user as any).roles;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        // TODO: roles を session に公開する
        // session.user.roles = token.roles;
      }
      return session;
    },
  },
};
