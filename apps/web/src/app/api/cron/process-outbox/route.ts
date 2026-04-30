import { NextResponse } from "next/server";
import { getLeaderApplicationOutboxWorker } from "@/lib/di/outbox";

/**
 * Outbox 自動処理 Cron エンドポイント (#187)
 *
 * Vercel Cron から定期的に呼ばれ、未送信の Outbox メッセージを順次処理する。
 *
 * - リハーサル (Hobby): daily (`0 0 * * *`) — 取りこぼし復旧用
 * - 本番 (Pro): more frequent (e.g. `* * * * *`) — 30s-1min SLA 担保
 *
 * 認証: `Authorization: Bearer ${CRON_SECRET}` で外部呼び出しから保護。
 *
 * PR1 スコープ: LeaderApplicationOutbox のみ。
 *   ProjectOutbox / 他の processor は PR2 で追加する (Issue #187)。
 */
export async function GET(request: Request) {
  // CRON_SECRET 未設定だと `Bearer undefined` として比較され、攻撃者がそれを送れば
  // 通ってしまうため fail-closed にする (#188 review M1)。
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET is not set");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const worker = getLeaderApplicationOutboxWorker();
    await worker.tick();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron] process-outbox failed:", message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
