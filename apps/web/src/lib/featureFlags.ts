/**
 * フィーチャーフラグ判定ユーティリティ
 *
 * Issue #192 PR #198 review C1 対応:
 * CAPTCHA / レートリミットがスタブのまま本番環境で応募 API が動かないように、
 * 本番（NODE_ENV === "production"）では明示的に flag を立てない限り
 * リーダー応募の受付を 503 で閉じるためのゲート。
 *
 * - サーバー側: `LEADER_APPLICATION_ENABLED`
 * - クライアント側: `NEXT_PUBLIC_LEADER_APPLICATION_ENABLED`
 *
 * staging / preview / local では常に有効（NODE_ENV !== "production"）。
 */

/**
 * "true" / "1" / "yes"（大文字小文字無視）のいずれかであれば true を返す。
 * それ以外（undefined / 空文字 / "false" 等）は false。
 */
function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/**
 * リーダー応募 API がサーバー側で受付可能か判定する。
 *
 * - production 以外: 常に true（staging/local で動作確認できるようにする）
 * - production: `LEADER_APPLICATION_ENABLED` が truthy のときのみ true
 */
export function isLeaderApplicationEnabledServer(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return parseBooleanEnv(process.env.LEADER_APPLICATION_ENABLED);
}

/**
 * リーダー応募 UI をクライアント側で表示するか判定する（Server Component から呼ぶ）。
 *
 * Next.js では `NEXT_PUBLIC_*` のみがクライアントバンドルに埋め込まれるため、
 * サーバー側の `LEADER_APPLICATION_ENABLED` とは別に公開用の env を読む。
 *
 * - production 以外: 常に true
 * - production: `NEXT_PUBLIC_LEADER_APPLICATION_ENABLED` が truthy のときのみ true
 */
export function isLeaderApplicationEnabledClient(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return parseBooleanEnv(process.env.NEXT_PUBLIC_LEADER_APPLICATION_ENABLED);
}
