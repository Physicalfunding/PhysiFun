import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * NextAuth.js APIルートハンドラ
 * @see https://next-auth.js.org/configuration/initialization#route-handlers-app
 *
 * このルートは以下のエンドポイントを自動的に処理:
 * - POST /api/auth/signin (ログイン)
 * - POST /api/auth/signout (ログアウト)
 * - GET /api/auth/session (セッション取得)
 * - GET /api/auth/csrf (CSRFトークン取得)
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
