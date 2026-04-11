import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";
import { prisma } from "@/infrastructure/database/prisma";
import { Email } from "@/domain/account/value-objects/Email";

/**
 * NextAuth.js 設定
 * @see https://next-auth.js.org/configuration/options
 *
 * Credentials Providerを使用してメール/パスワード認証を実装
 * JWTセッション戦略を採用し、httpOnly cookieでトークンを保存
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
       * 認証ロジック
       * メールアドレスとパスワードを検証し、ユーザー情報を返す
       */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // メールアドレスのバリデーション
          const emailResult = Email.create(credentials.email);
          if (!emailResult.success) {
            return null;
          }

          // ユーザーの検索
          const userRepository = new PrismaUserRepository(prisma);
          const user = await userRepository.findByEmail(emailResult.data);

          if (!user) {
            return null;
          }

          // パスワードの検証
          const isValid = await user.passwordHash.verify(credentials.password);
          if (!isValid) {
            return null;
          }

          // NextAuth用のユーザーオブジェクトを返す
          return {
            id: user.id.value,
            email: user.email.value,
            name: user.name,
            userType: user.userType,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
  ],

  /**
   * セッション設定
   * JWT戦略を使用し、セッション有効期間は30日
   */
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日
  },

  /**
   * JWT設定
   */
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30日
  },

  /**
   * ページ設定
   */
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login",
  },

  /**
   * コールバック
   * JWTトークンとセッションにカスタムフィールドを追加
   */
  callbacks: {
    /**
     * JWTトークンにユーザー情報を追加
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.userType = user.userType;
      }
      return token;
    },

    /**
     * セッションにユーザー情報を追加
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.userType = token.userType as string;
      }
      return session;
    },
  },
};
