/**
 * @jest-environment node
 *
 * middleware 全体の統合テスト (CSRF 層のみ)。
 *
 * `/my/*` 配下のテストは NextAuth の `withAuth` ラッパー (cookie / JWT 検証) に
 * 依存するためここでは扱わない。代わりに `/api/*` 系の body-less POST エンドポイント
 * (Issue #109 の対象: request-publish / withdraw / unpublish) に対して、
 * CSRF OK / NG でどのように応答されるかを検証する。
 */
import middleware from "../middleware";
import type { NextRequest } from "next/server";

function buildRequest(options: {
  method?: string;
  pathname?: string;
  headers?: Record<string, string>;
}): NextRequest {
  const method = options.method ?? "POST";
  const pathname = options.pathname ?? "/api/my/projects/abc/request-publish";
  const headers = new Map(
    Object.entries(options.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    method,
    nextUrl: { pathname, protocol: "https:" },
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
    },
  } as unknown as NextRequest;
}

describe("middleware (CSRF 層)", () => {
  const origEnv = process.env.NEXTAUTH_URL;
  beforeEach(() => {
    process.env.NEXTAUTH_URL = "https://app.example.com";
  });
  afterEach(() => {
    if (origEnv === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = origEnv;
  });

  it.each([
    "/api/my/projects/abc/request-publish",
    "/api/my/projects/abc/withdraw",
    "/api/my/projects/abc/unpublish",
  ])("同一オリジンの POST %s は通過する", async (pathname) => {
    const req = buildRequest({
      method: "POST",
      pathname,
      headers: {
        origin: "https://app.example.com",
        host: "app.example.com",
      },
    });
    const res = await middleware(req);
    // next() / undefined (pass-through) どちらでも 403 以外であれば CSRF は通過している。
    expect(res?.status).not.toBe(403);
  });

  it.each([
    "/api/my/projects/abc/request-publish",
    "/api/my/projects/abc/withdraw",
    "/api/my/projects/abc/unpublish",
  ])("クロスオリジンの POST %s は 403 で拒否される", async (pathname) => {
    const req = buildRequest({
      method: "POST",
      pathname,
      headers: {
        origin: "https://evil.example.com",
        host: "app.example.com",
      },
    });
    const res = await middleware(req);
    expect(res?.status).toBe(403);
    const body = await res!.json();
    expect(body).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "CSRF 検証に失敗しました" },
    });
  });

  it("GET はクロスオリジンでも通過する (safe method)", async () => {
    const req = buildRequest({
      method: "GET",
      pathname: "/api/my/projects/abc",
      headers: {
        origin: "https://evil.example.com",
        host: "app.example.com",
      },
    });
    const res = await middleware(req);
    expect(res?.status).not.toBe(403);
  });

  it("`/api/auth/*` はクロスオリジンでも通過する (NextAuth 管理)", async () => {
    const req = buildRequest({
      method: "POST",
      pathname: "/api/auth/callback/credentials",
      headers: {
        origin: "https://evil.example.com",
        host: "app.example.com",
      },
    });
    const res = await middleware(req);
    expect(res?.status).not.toBe(403);
  });
});
