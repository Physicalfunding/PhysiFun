import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

/**
 * NextAuth.js の型拡張（運営管理アプリ用）
 *
 * セッションと JWT に id と roles フィールドを追加する。
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles?: string[];
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    roles?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    roles?: string[];
  }
}
