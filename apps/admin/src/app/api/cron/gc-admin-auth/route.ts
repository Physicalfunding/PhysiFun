import { NextResponse } from "next/server";
import { PrismaAdminAuthGcAdapter } from "@physifun/infrastructure";

/**
 * 期限切れ AdminSession / AdminVerificationToken GC Cron (#158 M2)
 *
 * NextAuth v4 Database 戦略は expires を過ぎた行を自動削除しないため、
 * Vercel Cron から定期的に DELETE する。
 *
 * - vercel.json で `0 * * * *` (毎時) 実行
 * - `CRON_SECRET` を Authorization ヘッダ (Bearer) で検証
 * - 失敗時は 500 を返し stderr に出力 (Vercel ログに残る)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adapter = new PrismaAdminAuthGcAdapter();
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
