import { NextResponse } from "next/server";
import { verifyCronRequest } from "@physifun/server-shared";
import { CleanupExpiredPendingAccountsUseCase } from "@physifun/application";
import { KyselyCleanupExpiredAccountsAdapter } from "@physifun/infrastructure/src/kysely";

/**
 * 期限切れ PENDING_EMAIL_CONFIRMATION アカウント削除 Cron エンドポイント
 *
 * Vercel Cron から実行される。
 * CRON_SECRET による認証で不正アクセスを防止する（未設定なら 500 で拒否, #252）。
 */
export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  const port = new KyselyCleanupExpiredAccountsAdapter();
  const useCase = new CleanupExpiredPendingAccountsUseCase(port);
  const result = await useCase.execute();

  if (!result.ok) {
    console.error("[cron] cleanup-expired-accounts failed:", result.error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  console.log(`[cron] cleanup-expired-accounts: ${result.value.deletedCount} accounts deleted`);
  return NextResponse.json({ deletedCount: result.value.deletedCount });
}
