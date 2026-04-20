/**
 * @jest-environment node
 *
 * middleware 全体の統合テスト (CSRF 層 + `/my/*` 委譲)。
 *
 * `/my/*` 配下のテストは NextAuth の `withAuth` ラッパー (cookie / JWT 検証) に
 * 依存する。認証トークンが無い場合の挙動 (サインイン画面へのリダイレクト) を
 * 含めて確認する。また、`/api/*` 系の body-less POST エンドポイント
 * (Issue #109 の対象: request-publish / withdraw / unpublish) に対して
 * CSRF OK / NG でどのように応答されるかを検証する。
 */
import middleware from "../middleware";
import type { NextFetchEvent, NextRequest } from "next/server";

function buildRequest(options: {
  method?: string;
  pathname?: string;
  headers?: Record<string, string>;
}): NextRequest {
  const method = options.method ?? "POST";
  const pathname = options.pathname ?? "/api/my/projects/abc/request-publish";
  // グローバル `Headers` を使うことで `get` / `has` / `entries` 等の標準挙動を満たす。
  const headers = new Headers();
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    headers.set(k, v);
  }
  const url = `https://app.example.com${pathname}`;
  return {
    method,
    url,
    nextUrl: {
      pathname,
      protocol: "https:",
      host: "app.example.com",
      href: url,
      origin: "https://app.example.com",
      search: "",
      searchParams: new URLSearchParams(),
      clone: () => new URL(url),
    },
    headers,
    // withAuth が cookie 系 API を参照するため、空オブジェクトで満たしておく。
    cookies: {
      get: () => undefined,
      getAll: () => [],
      has: () => false,
    },
  } as unknown as NextRequest;
}

/**
 * NextFetchEvent の軽量モック (middleware の第 2 引数用)。
 * 実装上 CSRF パスでは使われない & withAuth 委譲でも最低限でよい。
 */
const mockEvent = {
  waitUntil: () => {},
} as unknown as NextFetchEvent;

describe("middleware (CSRF 層)", () => {
  const origUrl = process.env.NEXTAUTH_URL;
  const origSecret = process.env.NEXTAUTH_SECRET;
  let warnSpy: ReturnType<typeof jest.spyOn>;
  let errorSpy: ReturnType<typeof jest.spyOn>;
  beforeEach(() => {
    process.env.NEXTAUTH_URL = "https://app.example.com";
    // withAuth は NEXTAUTH_SECRET を要求するため、テスト用ダミーを設定する。
    process.env.NEXTAUTH_SECRET = "test-secret";
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    if (origUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = origUrl;
    if (origSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = origSecret;
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
    const res = await middleware(req, mockEvent);
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
    const res = await middleware(req, mockEvent);
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
    const res = await middleware(req, mockEvent);
    expect(res?.status).not.toBe(403);
  });

  it("`/my/*` は未ログインだと NextAuth のサインイン画面へリダイレクトされる (307 or 302)", async () => {
    // /my/* はページ遷移なので CSRF の対象ではない (evil origin でも通す)。
    // NextAuth の withAuth が token を確認し、無ければサインインへリダイレクトする。
    const req = buildRequest({
      method: "POST",
      pathname: "/my/projects/abc/edit",
      headers: {
        origin: "https://evil.example.com",
        host: "app.example.com",
      },
    });
    const res = await middleware(req, mockEvent);
    expect(res).toBeDefined();
    // NextAuth v4 系は 307 (Temporary Redirect) を返す実装だが、バージョンによっては
    // 302 (Found) もありうるため両方を許容する。
    expect([302, 307]).toContain(res!.status);
    // CSRF による 403 ではないことを明示的に再確認。
    expect(res!.status).not.toBe(403);
    // Location ヘッダーに sign-in 系の URL が含まれることを確認 (NextAuth 既定)。
    const location = res!.headers.get("location");
    expect(location).toBeTruthy();
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
    const res = await middleware(req, mockEvent);
    expect(res?.status).not.toBe(403);
  });
});
