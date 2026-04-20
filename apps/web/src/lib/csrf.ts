import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CSRF 保護の同一オリジン検証ユーティリティ。
 *
 * body-less POST や state-changing 系リクエストに対して、
 * `Origin` / `Referer` ヘッダーが自サイトと一致するかを検査する。
 *
 * 方針 (Issue #109):
 * - `Origin` ヘッダーを第一候補として検証する。
 * - `Origin` が存在しない / `null` の場合は `Referer` を fallback として検証する。
 * - どちらも無い場合は拒否 (same-origin リクエストでもブラウザは通常どちらかを送る)。
 * - 許可オリジンは `NEXTAUTH_URL` を第一に、無ければリクエスト自身のホスト (`X-Forwarded-Host` / `Host`) から導出する。
 *
 * 同期的な純関数として実装し、middleware から呼び出す。
 */

/** CSRF チェックをスキップするメソッド (safe methods)。 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** CSRF チェックをスキップするパス prefix。 */
const CSRF_SKIP_PATH_PREFIXES = ["/api/auth/"] as const;

/** CSRF チェックをスキップするパス完全一致。 */
const CSRF_SKIP_PATH_EXACT = ["/api/auth"] as const;

/**
 * リクエストが CSRF チェック対象かどうかを判定する。
 *
 * @param method HTTP メソッド
 * @param pathname リクエストパス (ex. `/api/my/projects`)
 */
export function shouldCheckCsrf(method: string, pathname: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) {
    return false;
  }
  for (const exact of CSRF_SKIP_PATH_EXACT) {
    if (pathname === exact) {
      return false;
    }
  }
  for (const prefix of CSRF_SKIP_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return false;
    }
  }
  return true;
}

/**
 * 期待されるオリジン (scheme + host[:port]) のセットを組み立てる。
 *
 * 優先順位 (セキュリティ最優先):
 * 1. `NEXTAUTH_URL` が設定されていればそれのみを信頼する (本番推奨)。
 * 2. `NEXTAUTH_URL` が未設定 or パース失敗のときだけ、開発 fallback として
 *    `X-Forwarded-Host` / `Host` ヘッダーから導出する。
 *
 * 注意: `X-Forwarded-Host` をリクエストから無条件に信頼すると、攻撃者が任意の
 * ヘッダーを送ってきた際にオリジンをすり替えられる余地がある。そのため本番では
 * `NEXTAUTH_URL` を必ず設定する前提とする。
 *
 * @param request NextRequest (ヘッダーと nextUrl から自ホストを推定する)
 */
export function getAllowedOrigins(request: NextRequest): string[] {
  const envUrl = process.env.NEXTAUTH_URL;
  if (envUrl) {
    try {
      const u = new URL(envUrl);
      return [`${u.protocol}//${u.host}`];
    } catch {
      // NEXTAUTH_URL が不正値の場合は開発 fallback へ
    }
  }

  // 開発 fallback: NEXTAUTH_URL が無い / 不正な場合のみ、リクエストのホストヘッダーを使う。
  const origins = new Set<string>();

  const forwardedProto = request.headers.get("x-forwarded-proto");

  // X-Forwarded-Host はカンマ区切りで複数値を持つことがある (例: "a.example.com, b.example.com")
  // 先頭の値だけを使う。
  const forwardedHostRaw = request.headers.get("x-forwarded-host");
  const forwardedHost = forwardedHostRaw?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto ?? "https";
    origins.add(`${proto}://${forwardedHost}`);
  }

  const host = request.headers.get("host");
  if (host) {
    // nextUrl.protocol は "https:" のような末尾コロン付き
    const proto = (forwardedProto ?? request.nextUrl.protocol.replace(/:$/, "")) || "https";
    origins.add(`${proto}://${host}`);
  }

  return Array.from(origins);
}

/**
 * URL 文字列から origin (scheme + host[:port]) を抽出する。
 * 不正な URL の場合は null。
 */
function originFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * CSRF チェックを実行する。
 *
 * @returns `null` のとき許可、`NextResponse` (403) のとき拒否。
 */
export function verifyCsrf(request: NextRequest): NextResponse | null {
  if (!shouldCheckCsrf(request.method, request.nextUrl.pathname)) {
    return null;
  }

  const allowed = getAllowedOrigins(request);
  if (allowed.length === 0) {
    // 自ホストも NEXTAUTH_URL も判定できない異常系: 安全側に倒して拒否。
    return csrfForbiddenResponse(request, "origin_unresolved");
  }

  const originHeader = request.headers.get("origin");
  if (originHeader && originHeader !== "null") {
    if (allowed.includes(originHeader)) {
      return null;
    }
    return csrfForbiddenResponse(request, "origin_mismatch");
  }

  // Origin が無い / "null" の場合は Referer をフォールバックとして検証する。
  const refererOrigin = originFromUrl(request.headers.get("referer"));
  if (refererOrigin && allowed.includes(refererOrigin)) {
    return null;
  }

  return csrfForbiddenResponse(request, "origin_missing");
}

/**
 * CSRF 拒否時の 403 レスポンス。
 * 既存の `apiResponse` 形式に合わせた JSON を返す。
 *
 * @param request 監査ログ出力用に reason 以外の情報 (pathname/method/ip) を参照する。
 * @param reason 内部ログ用の理由識別子 (クライアントには露出させない詳細は含めない)。
 */
function csrfForbiddenResponse(request: NextRequest, reason: string): NextResponse {
  // 監査用ログ。ヘッダー値はクライアントに露出させず、サーバー側 console にだけ出す。
  console.warn("[csrf] blocked", {
    reason,
    pathname: request.nextUrl.pathname,
    method: request.method,
    ip: request.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "CSRF 検証に失敗しました",
      },
    },
    {
      status: 403,
      headers: {
        // デバッグ・監査ログ用途の内部ヒント。
        "x-csrf-reason": reason,
      },
    }
  );
}
