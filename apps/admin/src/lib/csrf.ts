import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * admin 向け CSRF 保護の同一オリジン検証ユーティリティ (#166)
 *
 * 実装は apps/web/src/lib/csrf.ts と同ロジック。admin サブドメイン公開
 * (#147) に伴い web との防御ラインを統一するため、POST/PATCH/DELETE の
 * state-changing リクエストに対して `Origin` / `Referer` ヘッダーが自サイトと
 * 一致するかを検査する。
 *
 * 方針:
 * - `Origin` ヘッダーを第一候補として検証する。
 * - `Origin` が存在しない / `null` の場合は `Referer` を fallback として検証する。
 * - どちらも無い / 不一致なら 403 を返す。
 * - 許可オリジンは `NEXTAUTH_URL` を第一に、無ければ開発 fallback として
 *   リクエスト自身のホスト (`X-Forwarded-Host` / `Host`) から導出する。
 *
 * 除外:
 * - GET / HEAD / OPTIONS (safe methods)
 * - `/api/auth/*` (NextAuth が独自に CSRF token を検証するため)
 *
 * 同期的な純関数として実装し、admin middleware から呼び出す。
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
 * @param pathname リクエストパス (ex. `/api/admin/applications`)
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
 * 1. `NEXTAUTH_URL` が設定されていて正しい URL ならそれのみを信頼する (本番推奨)。
 * 2. `NEXTAUTH_URL` が設定されているがパース失敗なら `console.error` で警告した
 *    うえで空配列を返し、呼び出し側で `origin_unresolved` として 403 を返す
 *    (fail-safe)。`X-Forwarded-Host` への fallback はしない。
 * 3. `NEXTAUTH_URL` が完全に未設定のときのみ、開発 fallback として
 *    `X-Forwarded-Host` / `Host` ヘッダーから導出する。
 *
 * 設計意図: `NEXTAUTH_URL` が存在する = 運用者は明示的にオリジンを宣言している、
 * とみなす。不正値を放置して `X-Forwarded-Host` に落ちると攻撃者が任意のヘッダー
 * でオリジンをすり替えられるため、不正値は必ず拒否する。
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
      console.error("[csrf] NEXTAUTH_URL is set but not a valid URL; refusing to fall back", {
        NEXTAUTH_URL_length: envUrl.length,
      });
      return [];
    }
  }

  const origins = new Set<string>();

  const forwardedProtoRaw = request.headers.get("x-forwarded-proto");
  const forwardedProto = forwardedProtoRaw?.split(",")[0]?.trim() || null;

  const forwardedHostRaw = request.headers.get("x-forwarded-host");
  const forwardedHost = forwardedHostRaw?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto ?? "https";
    origins.add(`${proto}://${forwardedHost}`);
  }

  const host = request.headers.get("host");
  if (host) {
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
 * @param reason 内部ログ用の理由識別子 (本番ではクライアントに露出させない)。
 */
function csrfForbiddenResponse(request: NextRequest, reason: string): NextResponse {
  console.warn("[csrf] blocked", {
    reason,
    pathname: request.nextUrl.pathname,
    method: request.method,
    ip: request.headers.get("x-forwarded-for") ?? null,
  });

  // `x-csrf-reason` は開発時のデバッグ用途のみ付与する。
  const headers: Record<string, string> = {};
  if (process.env.NODE_ENV !== "production") {
    headers["x-csrf-reason"] = reason;
  }

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
      headers,
    }
  );
}
