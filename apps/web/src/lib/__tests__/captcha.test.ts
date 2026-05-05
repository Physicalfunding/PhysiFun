/**
 * @jest-environment node
 */
/**
 * `apps/web/src/lib/captcha.ts` の単体テスト (Issue #200)
 *
 * fetch をモックして siteverify の各分岐をカバーする。
 */
import { createTurnstileCaptchaVerifier } from "../captcha";

describe("createTurnstileCaptchaVerifier", () => {
  const ORIGINAL_ENV = process.env;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    fetchSpy = jest.spyOn(global, "fetch");
    // console.* はテスト出力を汚すので黙らせる（呼び出し記録は維持される）
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  describe("TURNSTILE_SECRET_KEY 未設定", () => {
    it("production では fail-closed で CAPTCHA_VERIFICATION_FAILED を返す", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.TURNSTILE_SECRET_KEY;

      const verifier = createTurnstileCaptchaVerifier();
      const result = await verifier.verify({ token: "abc", remoteIp: "1.2.3.4" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.type).toBe("CAPTCHA_VERIFICATION_FAILED");
      // fetch を呼ばずに即時で弾くこと
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("非 production では fail-open で ok を返す", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      delete process.env.TURNSTILE_SECRET_KEY;

      const verifier = createTurnstileCaptchaVerifier();
      const result = await verifier.verify({ token: "abc", remoteIp: "1.2.3.4" });

      expect(result.ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("siteverify 呼び出し", () => {
    beforeEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.TURNSTILE_SECRET_KEY = "secret-xxx";
    });

    it("success: true なら ok を返し、token と remoteIp を form-encoded で送る", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const verifier = createTurnstileCaptchaVerifier();
      const result = await verifier.verify({ token: "tk", remoteIp: "9.9.9.9" });

      expect(result.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
      expect(init.method).toBe("POST");
      const body = init.body as string;
      expect(body).toContain("secret=secret-xxx");
      expect(body).toContain("response=tk");
      expect(body).toContain("remoteip=9.9.9.9");
    });

    it("success: false なら CAPTCHA_VERIFICATION_FAILED を返す", async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const verifier = createTurnstileCaptchaVerifier();
      const result = await verifier.verify({ token: "bad", remoteIp: "1.2.3.4" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.type).toBe("CAPTCHA_VERIFICATION_FAILED");
    });

    it("HTTP エラー (5xx) なら CAPTCHA_VERIFICATION_FAILED を返す", async () => {
      fetchSpy.mockResolvedValue(new Response("internal error", { status: 500 }));

      const verifier = createTurnstileCaptchaVerifier();
      const result = await verifier.verify({ token: "tk", remoteIp: "1.2.3.4" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.type).toBe("CAPTCHA_VERIFICATION_FAILED");
    });

    it("fetch が throw した場合 (ネットワーク障害 / タイムアウト) は CAPTCHA_VERIFICATION_FAILED を返す", async () => {
      fetchSpy.mockRejectedValue(new Error("network error"));

      const verifier = createTurnstileCaptchaVerifier();
      const result = await verifier.verify({ token: "tk", remoteIp: "1.2.3.4" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.type).toBe("CAPTCHA_VERIFICATION_FAILED");
    });

    it("AbortSignal.timeout が fetch に渡されている", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const verifier = createTurnstileCaptchaVerifier();
      await verifier.verify({ token: "tk", remoteIp: "1.2.3.4" });

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.signal).toBeDefined();
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
