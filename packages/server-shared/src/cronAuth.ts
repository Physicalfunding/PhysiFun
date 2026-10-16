import { NextResponse } from "next/server";

/**
 * Vercel Cron ルートの認証（`Authorization: Bearer ${CRON_SECRET}`）を検証する（#189 / #252）。
 *
 * - `CRON_SECRET` が未設定なら 500 を返す（fail-closed）。
 *   未設定のまま `Bearer ${process.env.CRON_SECRET}` と比べると、`Bearer undefined` を送るだけで通ってしまうため
 * - ヘッダーが一致しなければ 401 を返す
 * - 一致すれば null を返す（呼び出し側は処理を続ける）
 *
 * 比較は内容について constant-time（timing attack 対策, #159 L-2）。
 * 長さが違う場合は内容比較まで進めずに 401 にする。`CRON_SECRET` の長さは固定運用で、
 * HTTPS 下では長さの情報が漏れても意味のある攻撃にならないため許容している。
 * middleware（Edge）からも読めるよう、`node:crypto` を使わずに比較している。
 *
 * @example
 * const unauthorized = verifyCronRequest(request);
 * if (unauthorized) return unauthorized;
 */
export function verifyCronRequest(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET is not set");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!constantTimeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** 2 つの文字列を、内容について constant-time で比較する（長さが違えば即 false） */
function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  if (x.length !== y.length) return false;

  let diff = 0;
  for (let i = 0; i < x.length; i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}
