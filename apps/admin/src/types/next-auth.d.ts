import type { DefaultSession } from "next-auth";

/**
 * NextAuth.js の型拡張（運営管理アプリ用 / #145）
 *
 * Database 戦略 + EmailProvider に切り替えたため、JWT 関連の型は不要。
 * session.user.id (AdminAccount.id) のみ拡張する。
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
