import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

/**
 * NextAuth.js の型拡張
 * セッションと JWT に `id` フィールドを追加する。
 * Phase 1 では Role/userType を session に含めず、必要時に DB を引く方針。
 *
 * @see https://next-auth.js.org/getting-started/typescript
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends DefaultUser {}
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
  }
}
