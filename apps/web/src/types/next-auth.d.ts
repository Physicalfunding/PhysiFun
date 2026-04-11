import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

/**
 * NextAuth.js の型拡張
 * セッションとJWTにカスタムフィールドを追加
 * @see https://next-auth.js.org/getting-started/typescript
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      userType: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    userType: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    userType: string;
  }
}
