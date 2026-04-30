import { NextResponse } from "next/server";
import { getLeaderApplicationOutboxWorker, getProjectOutboxWorker } from "@/lib/di/outbox";

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
 * 対象 (PR2 #187):
 *   - LeaderApplicationOutboxMessage (ACTIVATION_EMAIL / approved / rejected)
 *   - ProjectOutboxMessage (公開申請通知 / 承認 / 差戻 / 強制非公開)
 *
 * 失敗ハンドリング: どちらか一方の tick が失敗しても、他方の処理結果に
 * 影響させないため try-catch で個別にラップする。最後に 1 件でも失敗していれば
 * 500 を返し、Vercel のログから検知できるようにする。
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

  const errors: string[] = [];

  try {
    await getLeaderApplicationOutboxWorker().tick();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron] leader-application outbox tick failed:", message);
    errors.push(`leaderApplication: ${message}`);
  }

  try {
    await getProjectOutboxWorker().tick();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron] project outbox tick failed:", message);
    errors.push(`project: ${message}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Internal server error", errors }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
