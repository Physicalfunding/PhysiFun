/**
 * @jest-environment node
 */
import type { NextRequest } from "next/server";
import { shouldCheckCsrf, getAllowedOrigins, verifyCsrf } from "../csrf";

/**
 * `NextRequest` の必要なフィールドだけ満たす軽量モックを生成する。
 * `next/server` の `NextRequest` をそのまま構築すると Node 18 以前の環境で
 * ReadableStream 周りが不安定なので、必要最小限の shape を組み立てる。
 */
function buildMockRequest(options: {
  method?: string;
  pathname?: string;
  protocol?: string;
  headers?: Record<string, string>;
}): NextRequest {
  const method = options.method ?? "POST";
  const pathname = options.pathname ?? "/api/my/projects/p1/request-publish";
  const protocol = options.protocol ?? "https:";
  const headers = new Map(
    Object.entries(options.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
  );

  const mock = {
    method,
    nextUrl: {
      pathname,
      protocol,
    },
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
    },
  };

  return mock as unknown as NextRequest;
}

describe("shouldCheckCsrf", () => {
  it.each(["GET", "HEAD", "OPTIONS", "get", "head", "options"])(
    "safe method (%s) はスキップされる",
    (method) => {
      expect(shouldCheckCsrf(method, "/api/my/projects")).toBe(false);
    }
  );

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "state-changing method (%s) はチェック対象",
    (method) => {
      expect(shouldCheckCsrf(method, "/api/my/projects")).toBe(true);
    }
  );

  it("`/api/auth/*` はスキップされる (NextAuth 管理)", () => {
    expect(shouldCheckCsrf("POST", "/api/auth/callback/credentials")).toBe(false);
    expect(shouldCheckCsrf("POST", "/api/auth/signin")).toBe(false);
  });

  it("`/api/auth` 完全一致もスキップされる (NextAuth 管理)", () => {
    expect(shouldCheckCsrf("POST", "/api/auth")).toBe(false);
  });

  it("`/api/authorize` のような別パスはチェック対象", () => {
    // `/api/auth/` プレフィックス / `/api/auth` 完全一致のみスキップし、類似パスは対象。
    expect(shouldCheckCsrf("POST", "/api/authorize")).toBe(true);
  });
});

describe("getAllowedOrigins", () => {
  const origEnv = process.env.NEXTAUTH_URL;

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = origEnv;
    }
  });

  it("NEXTAUTH_URL が設定されていれば、それのみを返す (リクエストヘッダーは無視)", () => {
    process.env.NEXTAUTH_URL = "https://app.example.com";
    const req = buildMockRequest({
      headers: {
        host: "app.example.com",
        "x-forwarded-host": "attacker.example.com",
        "x-forwarded-proto": "https",
      },
    });
    const allowed = getAllowedOrigins(req);
    // NEXTAUTH_URL のみ信頼する。攻撃者が X-Forwarded-Host を詐称しても origins に混入しない。
    expect(allowed).toEqual(["https://app.example.com"]);
  });

  it("NEXTAUTH_URL が不正値のとき host ヘッダーから fallback する", () => {
    process.env.NEXTAUTH_URL = "::invalid::";
    const req = buildMockRequest({
      headers: { host: "localhost:3000" },
      protocol: "http:",
    });
    const allowed = getAllowedOrigins(req);
    expect(allowed).toContain("http://localhost:3000");
  });

  it("NEXTAUTH_URL 未設定の開発 fallback として X-Forwarded-Host / X-Forwarded-Proto を使う", () => {
    delete process.env.NEXTAUTH_URL;
    const req = buildMockRequest({
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "public.example.com",
        "x-forwarded-proto": "https",
      },
    });
    const allowed = getAllowedOrigins(req);
    expect(allowed).toContain("https://public.example.com");
  });

  it("X-Forwarded-Host がカンマ区切りの場合、先頭の値を使う", () => {
    delete process.env.NEXTAUTH_URL;
    const req = buildMockRequest({
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "first.example.com, second.example.com",
        "x-forwarded-proto": "https",
      },
    });
    const allowed = getAllowedOrigins(req);
    expect(allowed).toContain("https://first.example.com");
    expect(allowed).not.toContain("https://second.example.com");
  });
});

describe("verifyCsrf", () => {
  const origEnv = process.env.NEXTAUTH_URL;
  let warnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    process.env.NEXTAUTH_URL = "https://app.example.com";
    // 拒否時の監査ログ (console.warn) はテストでは抑制する。
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    if (origEnv === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = origEnv;
    }
  });

  it("safe method は常に通す", () => {
    const req = buildMockRequest({
      method: "GET",
      headers: { origin: "https://evil.example.com" },
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  it("`/api/auth/*` は通す", () => {
    const req = buildMockRequest({
      method: "POST",
      pathname: "/api/auth/callback/credentials",
      headers: { origin: "https://evil.example.com" },
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  it("Origin が NEXTAUTH_URL と一致すれば通す", () => {
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "https://app.example.com",
        host: "app.example.com",
      },
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  it("Origin が不一致なら 403 を返す", async () => {
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        host: "app.example.com",
      },
    });
    const res = verifyCsrf(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
    const body = await res!.json();
    expect(body).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "CSRF 検証に失敗しました" },
    });
    expect(res!.headers.get("x-csrf-reason")).toBe("origin_mismatch");
  });

  it("Origin が無い場合、Referer が一致すれば通す", () => {
    const req = buildMockRequest({
      method: "POST",
      headers: {
        referer: "https://app.example.com/my/projects/abc",
        host: "app.example.com",
      },
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  it("Origin が無く Referer も不一致なら 403", async () => {
    const req = buildMockRequest({
      method: "POST",
      headers: {
        referer: "https://evil.example.com/phish",
        host: "app.example.com",
      },
    });
    const res = verifyCsrf(req);
    expect(res?.status).toBe(403);
    expect(res!.headers.get("x-csrf-reason")).toBe("origin_missing");
  });

  it("Origin も Referer も無ければ 403", () => {
    const req = buildMockRequest({
      method: "POST",
      headers: { host: "app.example.com" },
    });
    const res = verifyCsrf(req);
    expect(res?.status).toBe(403);
  });

  it("Origin が `null` 文字列の場合は Referer を見る", () => {
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "null",
        referer: "https://app.example.com/my/projects/abc",
        host: "app.example.com",
      },
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  it("X-Forwarded-Host 配下 (Vercel 等) でも同一オリジンとみなす", () => {
    delete process.env.NEXTAUTH_URL;
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "https://preview-xyz.vercel.app",
        "x-forwarded-host": "preview-xyz.vercel.app",
        "x-forwarded-proto": "https",
        host: "internal:3000",
      },
    });
    expect(verifyCsrf(req)).toBeNull();
  });
});
