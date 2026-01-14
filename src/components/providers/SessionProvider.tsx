"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/common/Toast";

/**
 * AppProviders
 * アプリ全体で必要なプロバイダーをまとめて提供
 *
 * 含まれるプロバイダー:
 * - NextAuthSessionProvider: セッション管理
 * - ToastProvider: トースト通知
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </NextAuthSessionProvider>
  );
}
