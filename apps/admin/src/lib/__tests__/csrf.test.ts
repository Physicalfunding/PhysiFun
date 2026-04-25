/**
 * apps/admin CSRF 検証の単体 / 統合テスト (#166)
 *
 * apps/web 側と同等の検証を admin でも担保する。
 * 実行: `bun test apps/admin` (CI 本体と同じ)
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import type { NextRequest } from "next/server";
import { shouldCheckCsrf, getAllowedOrigins, verifyCsrf } from "../csrf";

/**
 * `NextRequest` の必要なフィールドだけ満たす軽量モックを生成する。
 * 実体の `NextRequest` を構築するのは Edge ランタイム前提で重いため、
 * `method` / `nextUrl.pathname` / `nextUrl.protocol` / `headers` だけ揃える。
 */
function buildMockRequest(options: {
  method?: string;
  pathname?: string;
  protocol?: string;
  headers?: Record<string, string>;
}): NextRequest {
  const method = options.method ?? "POST";
  const pathname = options.pathname ?? "/api/admin/applications/abc/approve";
  const protocol = options.protocol ?? "https:";
  const headers = new Headers();
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    headers.set(k, v);
  }

  const mock = {
    method,
    nextUrl: { pathname, protocol },
    headers,
  };
  return mock as unknown as NextRequest;
}

describe("shouldCheckCsrf (admin)", () => {
  test("safe method (GET) はスキップされる", () => {
    expect(shouldCheckCsrf("GET", "/api/admin/applications")).toBe(false);
  });

  test("safe method (HEAD/OPTIONS) はスキップされる", () => {
    expect(shouldCheckCsrf("HEAD", "/api/admin/applications")).toBe(false);
    expect(shouldCheckCsrf("OPTIONS", "/api/admin/applications")).toBe(false);
  });

  test("小文字メソッドでも safe method はスキップ", () => {
    expect(shouldCheckCsrf("get", "/api/admin/applications")).toBe(false);
  });

  test("POST/PATCH/DELETE はチェック対象", () => {
    expect(shouldCheckCsrf("POST", "/api/admin/applications/x/approve")).toBe(true);
    expect(shouldCheckCsrf("PATCH", "/api/admin/members/x")).toBe(true);
    expect(shouldCheckCsrf("DELETE", "/api/admin/members/x")).toBe(true);
  });

  test("/api/auth/ 配下はスキップ (NextAuth 管理)", () => {
    expect(shouldCheckCsrf("POST", "/api/auth/callback/email")).toBe(false);
    expect(shouldCheckCsrf("POST", "/api/auth/signin/email")).toBe(false);
    expect(shouldCheckCsrf("POST", "/api/auth/signout")).toBe(false);
  });

  test("/api/auth 完全一致もスキップ (NextAuth 管理)", () => {
    expect(shouldCheckCsrf("POST", "/api/auth")).toBe(false);
  });

  test("/api/authorize など類似パスはチェック対象", () => {
    expect(shouldCheckCsrf("POST", "/api/authorize")).toBe(true);
  });
});

describe("getAllowedOrigins (admin)", () => {
  const origEnv = process.env.NEXTAUTH_URL;

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = origEnv;
    }
  });

  test("NEXTAUTH_URL が設定されていれば、それのみを返す (リクエストヘッダー無視)", () => {
    process.env.NEXTAUTH_URL = "https://admin.example.com";
    const req = buildMockRequest({
      headers: {
        host: "admin.example.com",
        "x-forwarded-host": "attacker.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(getAllowedOrigins(req)).toEqual(["https://admin.example.com"]);
  });

  test("NEXTAUTH_URL が不正値なら空配列 (host fallback に落ちない, fail-safe)", () => {
    process.env.NEXTAUTH_URL = "::invalid::";
    const req = buildMockRequest({
      headers: {
        host: "attacker.example.com",
        "x-forwarded-host": "attacker.example.com",
      },
      protocol: "http:",
    });
    expect(getAllowedOrigins(req)).toEqual([]);
  });

  test("NEXTAUTH_URL 未設定なら開発 fallback として X-Forwarded-Host / -Proto を使う", () => {
    delete process.env.NEXTAUTH_URL;
    const req = buildMockRequest({
      headers: {
        host: "internal:3001",
        "x-forwarded-host": "admin.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(getAllowedOrigins(req)).toContain("https://admin.example.com");
  });

  test("X-Forwarded-Host がカンマ区切りなら先頭のみ採用", () => {
    delete process.env.NEXTAUTH_URL;
    const req = buildMockRequest({
      headers: {
        host: "internal:3001",
        "x-forwarded-host": "first.example.com, second.example.com",
        "x-forwarded-proto": "https",
      },
    });
    const allowed = getAllowedOrigins(req);
    expect(allowed).toContain("https://first.example.com");
    expect(allowed).not.toContain("https://second.example.com");
  });
});

describe("verifyCsrf (admin)", () => {
  const origEnv = process.env.NEXTAUTH_URL;
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NEXTAUTH_URL = "https://admin.example.com";
  });

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = origEnv;
    }
    Object.defineProperty(process.env, "NODE_ENV", {
      value: origNodeEnv,
      configurable: true,
    });
  });

  test("safe method (GET) は常に通す", () => {
    const req = buildMockRequest({
      method: "GET",
      headers: { origin: "https://evil.example.com" },
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  test("/api/auth/ 配下は通す (NextAuth 管理)", () => {
    const req = buildMockRequest({
      method: "POST",
      pathname: "/api/auth/signin/email",
      headers: { origin: "https://evil.example.com" },
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  test("Origin が NEXTAUTH_URL と一致すれば通す", () => {
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        host: "admin.example.com",
      },
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  test("Origin が不一致なら 403 を返す (admin POST)", () => {
    const req = buildMockRequest({
      method: "POST",
      pathname: "/api/admin/applications/abc/approve",
      headers: {
        origin: "https://evil.example.com",
        host: "admin.example.com",
      },
    });
    const res = verifyCsrf(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  test("PATCH も CSRF チェック対象", () => {
    const req = buildMockRequest({
      method: "PATCH",
      pathname: "/api/admin/members/abc",
      headers: {
        origin: "https://evil.example.com",
        host: "admin.example.com",
      },
    });
    expect(verifyCsrf(req)?.status).toBe(403);
  });

  test("DELETE も CSRF チェック対象", () => {
    const req = buildMockRequest({
      method: "DELETE",
      pathname: "/api/admin/members/abc",
      headers: {
        origin: "https://evil.example.com",
        host: "admin.example.com",
      },
    });
    expect(verifyCsrf(req)?.status).toBe(403);
  });

  test("Origin が無い場合、Referer が一致すれば通す", () => {
    const req = buildMockRequest({
      method: "POST",
      headers: {
        referer: "https://admin.example.com/applications/abc",
        host: "admin.example.com",
      },
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  test("Origin が無く Referer も不一致なら 403", () => {
    const req = buildMockRequest({
      method: "POST",
      headers: {
        referer: "https://evil.example.com/phish",
        host: "admin.example.com",
      },
    });
    expect(verifyCsrf(req)?.status).toBe(403);
  });

  test("Origin も Referer も無ければ 403", () => {
    const req = buildMockRequest({
      method: "POST",
      headers: { host: "admin.example.com" },
    });
    expect(verifyCsrf(req)?.status).toBe(403);
  });

  test("Origin が `null` 文字列の場合は Referer を見る", () => {
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "null",
        referer: "https://admin.example.com/applications/abc",
        host: "admin.example.com",
      },
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  test("NEXTAUTH_URL が不正値なら POST は 403 で拒否 (origin_unresolved)", () => {
    process.env.NEXTAUTH_URL = "::invalid::";
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        host: "admin.example.com",
      },
    });
    expect(verifyCsrf(req)?.status).toBe(403);
  });

  test("Vercel プレビューでも X-Forwarded-Host 経由で同一オリジン判定できる", () => {
    delete process.env.NEXTAUTH_URL;
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "https://preview-abc.vercel.app",
        "x-forwarded-host": "preview-abc.vercel.app",
        "x-forwarded-proto": "https",
        host: "internal:3001",
      },
    });
    expect(verifyCsrf(req)).toBeNull();
  });
});
