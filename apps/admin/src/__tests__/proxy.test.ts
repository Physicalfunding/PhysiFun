/**
 * admin の proxy（旧 middleware）のユニットテスト (#337)。
 *
 * `proxy.ts` は Next.js 16 が規約で export 名 `proxy` を拾う。名前がずれると CSRF 検証も
 * `/login` へのリダイレクトも黙って消えるため、`import { proxy }` で named export を参照する
 * このテストが「export 名のずれを typecheck / test で落とす」役割を兼ねる。
 *
 * 確かめるのは proxy の 3 つの責務だけ:
 * 1. `/api/*` の state-changing リクエストの CSRF 検証（`/api/auth/*` は除外）
 * 2. `/login` 配下は素通し
 * 3. それ以外のページは NextAuth セッション Cookie の有無だけを見て、無ければ `/login` へ
 *
 * 認可の最終防衛線は RSC / Route Handler 側（`getAuthenticatedAdminId()`）にあり、proxy に
 * role チェック等を足さない設計なので、ここでも Cookie の「値の正しさ」は確かめない。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { proxy } from "../proxy";
import type { NextRequest } from "next/server";

const ADMIN_ORIGIN = "https://admin.example.com";

function buildRequest(options: {
  method?: string;
  pathname?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}): NextRequest {
  const method = options.method ?? "GET";
  const pathname = options.pathname ?? "/";
  // グローバル `Headers` を使うことで `get` / `has` / `entries` 等の標準挙動を満たす。
  const headers = new Headers();
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    headers.set(k, v);
  }
  const cookies = options.cookies ?? {};
  const url = `${ADMIN_ORIGIN}${pathname}`;
  return {
    method,
    url,
    nextUrl: {
      pathname,
      protocol: "https:",
      host: "admin.example.com",
      href: url,
      origin: ADMIN_ORIGIN,
      search: "",
      searchParams: new URLSearchParams(),
      clone: () => new URL(url),
    },
    headers,
    // proxy は `cookies.get(name)?.value` しか見ないので、その形だけ満たす。
    cookies: {
      get: (name: string) => (name in cookies ? { name, value: cookies[name] } : undefined),
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
      has: (name: string) => name in cookies,
    },
  } as unknown as NextRequest;
}

describe("admin proxy", () => {
  const origUrl = process.env.NEXTAUTH_URL;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    process.env.NEXTAUTH_URL = ADMIN_ORIGIN;
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    if (origUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = origUrl;
  });

  describe("CSRF 層 (`/api/*`)", () => {
    it("別オリジンの POST /api/admin/applications/x/approve は 403 で拒否される", async () => {
      const req = buildRequest({
        method: "POST",
        pathname: "/api/admin/applications/x/approve",
        headers: { origin: "https://evil.example.com", host: "admin.example.com" },
      });
      const res = proxy(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({
        success: false,
        error: { code: "FORBIDDEN", message: "CSRF 検証に失敗しました" },
      });
    });

    it("同一オリジンの POST /api/admin/applications/x/approve は通過する", () => {
      const req = buildRequest({
        method: "POST",
        pathname: "/api/admin/applications/x/approve",
        headers: { origin: ADMIN_ORIGIN, host: "admin.example.com" },
      });
      const res = proxy(req);
      expect(res.status).not.toBe(403);
      expect(res.headers.get("location")).toBeNull();
    });

    it("Cookie が無くても `/api/*` は proxy ではリダイレクトしない (認可は Route Handler 側)", () => {
      const req = buildRequest({
        method: "POST",
        pathname: "/api/admin/applications/x/approve",
        headers: { origin: ADMIN_ORIGIN, host: "admin.example.com" },
      });
      const res = proxy(req);
      expect(res.status).not.toBe(403);
      expect(res.headers.get("location")).toBeNull();
    });

    it("GET は別オリジンでも通過する (safe method)", () => {
      const req = buildRequest({
        method: "GET",
        pathname: "/api/admin/applications",
        headers: { origin: "https://evil.example.com", host: "admin.example.com" },
      });
      const res = proxy(req);
      expect(res.status).not.toBe(403);
    });

    it("POST /api/auth/callback/email は別オリジンでも通過する (NextAuth 管理、CSRF 対象外)", () => {
      const req = buildRequest({
        method: "POST",
        pathname: "/api/auth/callback/email",
        headers: { origin: "https://evil.example.com", host: "admin.example.com" },
      });
      const res = proxy(req);
      expect(res.status).not.toBe(403);
    });
  });

  describe("`/login` 配下", () => {
    it.each(["/login", "/login/verify"])("%s は Cookie 無しでも素通しする", (pathname) => {
      const res = proxy(buildRequest({ pathname }));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("それ以外のページ (セッション Cookie の有無だけを見る)", () => {
    it.each(["/", "/applications/x"])(
      "Cookie 無しで %s を開くと /login へリダイレクトされる",
      (pathname) => {
        const res = proxy(buildRequest({ pathname }));
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe(`${ADMIN_ORIGIN}/login`);
      }
    );

    it("Cookie の値が空文字なら無いものとして扱い /login へリダイレクトされる", () => {
      const res = proxy(
        buildRequest({ pathname: "/", cookies: { "next-auth.session-token": "" } })
      );
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(`${ADMIN_ORIGIN}/login`);
    });

    it.each(["next-auth.session-token", "__Secure-next-auth.session-token"])(
      "%s があれば / を通す",
      (cookieName) => {
        const res = proxy(
          buildRequest({ pathname: "/", cookies: { [cookieName]: "any-opaque-value" } })
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("location")).toBeNull();
      }
    );
  });
});
