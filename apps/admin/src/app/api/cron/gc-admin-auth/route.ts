import { NextResponse } from "next/server";
import { verifyCronRequest } from "@physifun/server-shared";
import { KyselyAdminAuthGcAdapter } from "@physifun/infrastructure/src/kysely";

/**
 * 期限切れ AdminSession / AdminVerificationToken GC Cron
 *
 * - 本体: #158 M2 (cron 動線 + GC アダプタ追加)
 * - 強化: #159 L-2 (CRON_SECRET 検証を timingSafeEqual 化)
 *
 * NextAuth v4 Database 戦略は expires を過ぎた行を自動削除しないため、
 * Vercel Cron から定期的に DELETE する。
 *
 * - vercel.json で `0 * * * *` (毎時) 実行
 * - `CRON_SECRET` を Authorization ヘッダ (Bearer) で検証（`@physifun/server-shared` の verifyCronRequest。未設定なら 500）
 * - 失敗時は 500 を返し stderr に出力 (Vercel ログに残る)
 */
export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const adapter = new KyselyAdminAuthGcAdapter();
    const result = await adapter.deleteExpired();
    console.log(
      `[cron] gc-admin-auth: sessions=${result.deletedSessions} tokens=${result.deletedVerificationTokens}`
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("[cron] gc-admin-auth failed:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
