import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
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
 * - `CRON_SECRET` を Authorization ヘッダ (Bearer) で検証
 * - 失敗時は 500 を返し stderr に出力 (Vercel ログに残る)
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

/**
 * CRON_SECRET を timing-safe に検証する (#159 L-2 / 追加レビュー H-1)。
 *
 * 文字列 `===` は先頭 N バイト一致時点で早期 return するため、
 * 大量リクエスト統計から 1 バイトずつ値を推測される timing attack が
 * 理論上可能になる。本番は HTTPS 下 + Vercel Cron のみが叩く閉じた経路
 * なので攻撃成立は極めて困難だが、`crypto.timingSafeEqual` を使うことで
 * 「内容一致」判定を constant-time 化しておく。
 *
 * ## constant-time の範囲 (正直な書き方)
 * - **内容一致部分は constant-time** (`timingSafeEqual(a, b)`)
 * - **長さ一致チェックは branch している** (`a.length !== b.length` で早期 return)
 *   → 厳密には「期待値とバイト長が違う入力」は timingSafeEqual 未到達で即 401。
 *     攻撃者に長さ情報は漏れうるが、`CRON_SECRET` の長さは固定運用で、
 *     かつ HTTPS 下では意味のある攻撃にならないため許容する。
 *   → 完全 constant-time 化には入力を期待長に padding してから比較する必要があるが、
 *     Vercel Cron 環境では過剰と判断し採用しない。
 *
 * その他:
 * - `CRON_SECRET` が未設定なら常に false (誤って開放されるのを防ぐ)
 */
function isAuthorizedCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expected}`;

  const a = Buffer.from(authHeader);
  const b = Buffer.from(expectedHeader);

  if (a.length !== b.length) {
    // 長さ違い = 明らかに異なる secret。内容比較まで進めず 401。
    // (長さ情報の漏洩は上記 docstring の通り許容)
    return false;
  }
  return timingSafeEqual(a, b);
}
