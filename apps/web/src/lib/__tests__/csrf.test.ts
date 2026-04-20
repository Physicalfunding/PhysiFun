/**
 * @jest-environment node
 */
import type { NextRequest } from "next/server";
import { shouldCheckCsrf, getAllowedOrigins, verifyCsrf } from "../csrf";

/**
 * `NextRequest` の必要なフィールドだけ満たす軽量モックを生成する。
 * `next/server` の `NextRequest` をそのまま構築すると Node 18 以前の環境で
 * ReadableStream 周りが不安定なので、必要最小限の shape を組み立てる。
 *
 * ヘッダーはグローバル `Headers` (Node 18+) をそのまま利用することで、
 * `get` / `has` / `entries` / `forEach` などの標準挙動をそのまま検証に使える。
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
  const headers = new Headers();
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    headers.set(k, v);
  }

  const mock = {
    method,
    nextUrl: {
      pathname,
      protocol,
    },
    headers,
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
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
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

  it("NEXTAUTH_URL が不正値なら空配列を返し、host fallback に落ちない (fail-safe)", () => {
    process.env.NEXTAUTH_URL = "::invalid::";
    const req = buildMockRequest({
      headers: {
        host: "attacker.example.com",
        "x-forwarded-host": "attacker.example.com",
      },
      protocol: "http:",
    });
    const allowed = getAllowedOrigins(req);
    // X-Forwarded-Host / Host に一切 fallback しないことが重要。
    expect(allowed).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("NEXTAUTH_URL"),
      expect.any(Object)
    );
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

  it("X-Forwarded-Proto がカンマ区切り (例: 'https, http') の場合、先頭の値のみ使う", () => {
    delete process.env.NEXTAUTH_URL;
    const req = buildMockRequest({
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "public.example.com",
        "x-forwarded-proto": "https, http",
      },
    });
    const allowed = getAllowedOrigins(req);
    expect(allowed).toContain("https://public.example.com");
    // 2 つ目の proto "http" で誤って "http://public.example.com" が混入してはいけない。
    expect(allowed).not.toContain("http://public.example.com");
  });

  it("NEXTAUTH_URL 未設定かつ host ヘッダーも無い場合は空配列を返す", () => {
    delete process.env.NEXTAUTH_URL;
    const req = buildMockRequest({
      headers: {},
    });
    const allowed = getAllowedOrigins(req);
    expect(allowed).toEqual([]);
  });
});

describe("verifyCsrf", () => {
  const origEnv = process.env.NEXTAUTH_URL;
  const origNodeEnv = process.env.NODE_ENV;
  let warnSpy: ReturnType<typeof jest.spyOn>;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    process.env.NEXTAUTH_URL = "https://app.example.com";
    // 拒否時の監査ログ (console.warn / error) はテストでは抑制する。
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    if (origEnv === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = origEnv;
    }
    // NODE_ENV を復元
    Object.defineProperty(process.env, "NODE_ENV", {
      value: origNodeEnv,
      configurable: true,
    });
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

  it("Origin が不一致なら 403 を返す (dev では x-csrf-reason 付き)", async () => {
    // dev 環境として実行 (デフォルト NODE_ENV が test なので明示的に development に上書き)
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      configurable: true,
    });
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
    // dev 環境では x-csrf-reason が付与される。
    expect(res!.headers.get("x-csrf-reason")).toBe("origin_mismatch");
  });

  it("本番環境 (NODE_ENV=production) では x-csrf-reason ヘッダーを付けない", async () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
    });
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        host: "app.example.com",
      },
    });
    const res = verifyCsrf(req);
    expect(res?.status).toBe(403);
    // 本番では内部事由を公開しないため null。
    expect(res!.headers.get("x-csrf-reason")).toBeNull();
    // 監査ログとしては依然 console.warn に出ている。
    expect(warnSpy).toHaveBeenCalled();
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

  it("Origin が無く Referer も不一致なら 403 (dev で x-csrf-reason=origin_missing)", async () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      configurable: true,
    });
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

  it("NEXTAUTH_URL が不正値なら state-changing リクエストは 403 で拒否される (origin_unresolved)", async () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      configurable: true,
    });
    process.env.NEXTAUTH_URL = "::invalid::";
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "https://app.example.com",
        host: "app.example.com",
      },
    });
    const res = verifyCsrf(req);
    expect(res?.status).toBe(403);
    expect(res!.headers.get("x-csrf-reason")).toBe("origin_unresolved");
  });

  it("開発 fallback: NEXTAUTH_URL 未設定 + host 無し → 403 (origin_unresolved)", async () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      configurable: true,
    });
    delete process.env.NEXTAUTH_URL;
    const req = buildMockRequest({
      method: "POST",
      headers: {
        // host / x-forwarded-host / origin いずれも無い
      },
    });
    const res = verifyCsrf(req);
    expect(res?.status).toBe(403);
    expect(res!.headers.get("x-csrf-reason")).toBe("origin_unresolved");
  });

  it("開発 fallback: x-forwarded-proto が複数値でも先頭で評価される", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      configurable: true,
    });
    delete process.env.NEXTAUTH_URL;
    const req = buildMockRequest({
      method: "POST",
      headers: {
        origin: "https://app.example.com",
        host: "app.example.com",
        "x-forwarded-proto": "https, http",
      },
    });
    expect(verifyCsrf(req)).toBeNull();
  });
});
