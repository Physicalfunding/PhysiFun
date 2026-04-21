import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { PrismaAdminAuthGcAdapter } from "@physifun/infrastructure";

/**
 * 期限切れ AdminSession / AdminVerificationToken GC Cron (#158 M2 / #159 L-2)
 *
 * NextAuth v4 Database 戦略は expires を過ぎた行を自動削除しないため、
 * Vercel Cron から定期的に DELETE する。
 *
 * - vercel.json で `0 * * * *` (毎時) 実行
 * - `CRON_SECRET` を Authorization ヘッダ (Bearer) で検証。
 *   比較は `crypto.timingSafeEqual` を使用し timing attack を回避する (#159 L-2)
 * - 失敗時は 500 を返し stderr に出力 (Vercel ログに残る)
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
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

/**
 * CRON_SECRET を timing-safe に検証する。
 *
 * 文字列 `===` は長さ / 先頭一致で早期 return するため、
 * 大量リクエスト統計から 1 文字ずつ値を推測される timing attack が
 * 理論上可能になる。本番は HTTPS 下なので攻撃成立はさらに困難だが、
 * cron endpoint が CRON_SECRET のみで保護される以上、防御レイヤとして
 * `crypto.timingSafeEqual` を使う。
 *
 * - `CRON_SECRET` が未設定なら常に false (誤って開放されるのを防ぐ)
 * - 入力バイト長が期待値と異なるときは長さ漏洩しないよう ByteLen を合わせてから比較
 */
function isAuthorizedCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expected}`;

  const a = Buffer.from(authHeader);
  const b = Buffer.from(expectedHeader);

  // 長さ違いでも timingSafeEqual が throw しないよう、同じ長さの buffer を作って比較した上で
  // 長さ一致チェックを AND する。これにより「一致 == (長さ一致) && (内容一致)」を一定時間で評価。
  if (a.length !== b.length) {
    // 長さを揃えて比較するダミー計算 (早期 return で長さを漏らさない)
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
