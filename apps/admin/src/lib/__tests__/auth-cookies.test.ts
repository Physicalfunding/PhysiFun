/**
 * apps/admin Cookie 設定の不変条件テスト (#147)
 *
 * サブドメイン分離のセキュリティ境界を守るため、以下を守る:
 *   - `domain` 属性は必ず `undefined` (host-only cookie)
 *   - 本番 (https) では secure=true かつ `__Secure-` / `__Host-` プレフィックスが付く
 *   - `sameSite` は "lax"
 *
 * この invariant が壊れると運営セッションが親ドメイン / 兄弟サブドメインに
 * 漏出するリスクがあるため、コード変更で誤って緩められないよう回帰テストとして残す。
 *
 * 実行: `bun test apps/admin` (CI 本体と同じ). `bun:test` の jest 互換 API を使う。
 */

// `bun:test` の ambient 型宣言は apps/admin/src/types/bun-test.d.ts を参照。
import { describe, test, expect, afterEach, mock } from "bun:test";

// DI コンテナの副作用を避けるため、依存モジュールを最初にモックする。
// `authOptions` は module top-level で評価されるため、import 前にモック登録が必要。
mock.module("../di/auth", () => ({
  getAdminPrismaAdapter: () => ({}),
  getIsActiveAdminByEmail: () => async () => false,
  getSendAdminMagicLink: () => async () => {},
}));

mock.module("../rateLimit", () => ({
  checkAdminMagicLinkRateLimit: () => ({ ok: true }),
}));

// NextAuth EmailProvider は内部で `require("nodemailer")` するが、
// apps/admin は ResendMailSender 経由で送信するため nodemailer を dependency に入れていない。
// テスト実行時に EmailProvider の import が走るだけでエラーになるのでスタブ化する。
mock.module("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: async () => {} }) },
  createTransport: () => ({ sendMail: async () => {} }),
}));

describe("apps/admin auth cookies (#147)", () => {
  const originalEnv = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalEnv;
  });

  async function loadAuthOptions() {
    // NEXTAUTH_URL 切替時に auth.ts を再読み込みするため、import cache をバイパス
    // (bun には jest.resetModules が無いので dynamic import + query で代用)
    const mod = (await import(
      `../auth?t=${Date.now()}${Math.random()}`
    )) as typeof import("../auth");
    return mod.authOptions;
  }

  test("本番 (https) では session/callback cookie に __Secure- プレフィックスが付き domain は未指定", async () => {
    process.env.NEXTAUTH_URL = "https://admin.physifun.com";
    const authOptions = await loadAuthOptions();
    const cookies = authOptions.cookies!;

    expect(cookies.sessionToken?.name).toBe("__Secure-next-auth.session-token");
    expect(cookies.sessionToken?.options.secure).toBe(true);
    expect(cookies.sessionToken?.options.sameSite).toBe("lax");
    expect(cookies.sessionToken?.options.httpOnly).toBe(true);
    // domain 未指定 (host-only) であることを保証
    expect(cookies.sessionToken?.options.domain).toBeUndefined();

    expect(cookies.callbackUrl?.name).toBe("__Secure-next-auth.callback-url");
    expect(cookies.callbackUrl?.options.domain).toBeUndefined();

    expect(cookies.csrfToken?.name).toBe("__Host-next-auth.csrf-token");
    expect(cookies.csrfToken?.options.secure).toBe(true);
    expect(cookies.csrfToken?.options.domain).toBeUndefined();
  });

  test("ローカル開発 (http) では secure=false + プレフィックスなし", async () => {
    process.env.NEXTAUTH_URL = "http://localhost:3001";
    const authOptions = await loadAuthOptions();
    const cookies = authOptions.cookies!;

    expect(cookies.sessionToken?.name).toBe("next-auth.session-token");
    expect(cookies.sessionToken?.options.secure).toBe(false);
    expect(cookies.sessionToken?.options.domain).toBeUndefined();

    expect(cookies.csrfToken?.name).toBe("next-auth.csrf-token");
    expect(cookies.csrfToken?.options.secure).toBe(false);
    expect(cookies.csrfToken?.options.domain).toBeUndefined();
  });
});
