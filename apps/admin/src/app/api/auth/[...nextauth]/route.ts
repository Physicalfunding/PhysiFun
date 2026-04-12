import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * 運営管理アプリ用 NextAuth.js API ルートハンドラ
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
