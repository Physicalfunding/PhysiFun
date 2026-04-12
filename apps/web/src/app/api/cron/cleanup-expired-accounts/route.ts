import { NextResponse } from "next/server";
import { CleanupExpiredPendingAccountsUseCase } from "@physifun/application";
import { PrismaCleanupExpiredAccountsAdapter } from "@physifun/infrastructure";

/**
 * 期限切れ PENDING_EMAIL_CONFIRMATION アカウント削除 Cron エンドポイント
 *
 * Vercel Cron で毎時実行される。
 * CRON_SECRET による認証で不正アクセスを防止する。
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const port = new PrismaCleanupExpiredAccountsAdapter();
  const useCase = new CleanupExpiredPendingAccountsUseCase(port);
  const result = await useCase.execute();

  if (!result.ok) {
    console.error("[cron] cleanup-expired-accounts failed:", result.error.message);
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  console.log(`[cron] cleanup-expired-accounts: ${result.value.deletedCount} accounts deleted`);
  return NextResponse.json({ deletedCount: result.value.deletedCount });
}
