"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

/**
 * SessionProvider
 * NextAuth.jsのセッション管理をクライアントコンポーネントに提供
 *
 * アプリ全体でセッション状態にアクセスできるようにする
 * useSession()フックを使用するために必要
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
