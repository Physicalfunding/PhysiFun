/**
 * apps/admin Cookie 設定の不変条件テスト (#147)
 *
 * サブドメイン分離のセキュリティ境界を守るため、以下を守る:
 *   - `domain` 属性は必ず `undefined` (host-only cookie)
 *   - 本番 (https) では secure=true かつ `__Secure-` / `__Host-` プレフィックスが付く
 *   - `sameSite` は "lax"
 *   - callbackUrl cookie は NextAuth デフォルト (httpOnly 未指定) に従う
 *
 * この invariant が壊れると運営セッションが親ドメイン / 兄弟サブドメインに
 * 漏出するリスクがあるため、コード変更で誤って緩められないよう回帰テストとして残す。
 *
 * ## 実装方針 (#147 Blocker B-1)
 * 以前は `authOptions.cookies` が `process.env.NEXTAUTH_URL` を直接参照していたため、
 * 本番 / ローカルの切り替えテストに動的 import + キャッシュバイパス
 * (`import("../auth?t=...")`) を使っていた。現在は `buildCookieOptions(isHttps)` という
 * 純粋関数に切り出されているので、env 変数を触らずに両ケースを直接検証できる。
 *
 * ただし `auth.ts` の module top-level では `getAdminPrismaAdapter()` と
 * EmailProvider の初期化が走るため、依存モジュールは事前にモックしてから import する。
 *
 * 実行: `bun test apps/admin` (CI 本体と同じ). `bun:test` の jest 互換 API を使う。
 */

// `bun:test` の ambient 型宣言は apps/admin/src/types/bun-test.d.ts を参照。
import { describe, test, expect, mock } from "bun:test";

// DI コンテナの副作用 (Prisma Client 初期化等) を避けるため、
// `auth.ts` を import する前に依存モジュールをモックする。
mock.module("../di/auth", () => ({
  getAdminPrismaAdapter: () => ({}),
  getIsActiveAdminByEmail: () => async () => false,
  getSendAdminMagicLink: () => async () => {},
}));

// NextAuth EmailProvider は内部で `require("nodemailer")` するが、
// apps/admin は ResendMailSender 経由で送信するため nodemailer を dependency に入れていない。
mock.module("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: async () => {} }) },
  createTransport: () => ({ sendMail: async () => {} }),
}));

const { buildCookieOptions } = await import("../auth");

describe("apps/admin auth cookies (#147)", () => {
  test("本番 (https) では session/callback cookie に __Secure- プレフィックスが付き domain は未指定", () => {
    const cookies = buildCookieOptions(true)!;

    expect(cookies.sessionToken?.name).toBe("__Secure-next-auth.session-token");
    expect(cookies.sessionToken?.options.secure).toBe(true);
    expect(cookies.sessionToken?.options.sameSite).toBe("lax");
    expect(cookies.sessionToken?.options.httpOnly).toBe(true);
    // domain 未指定 (host-only) であることを保証
    expect(cookies.sessionToken?.options.domain).toBeUndefined();
    // path="/" は Cookie の送出スコープを全パスに揃えるための invariant (#147 M-2)
    expect(cookies.sessionToken?.options.path).toBe("/");

    expect(cookies.callbackUrl?.name).toBe("__Secure-next-auth.callback-url");
    expect(cookies.callbackUrl?.options.domain).toBeUndefined();
    // Major M-2: callbackUrl は NextAuth デフォルト (httpOnly を立てない) に従う
    expect(cookies.callbackUrl?.options.httpOnly).toBeUndefined();
    expect(cookies.callbackUrl?.options.path).toBe("/");

    expect(cookies.csrfToken?.name).toBe("__Host-next-auth.csrf-token");
    expect(cookies.csrfToken?.options.secure).toBe(true);
    expect(cookies.csrfToken?.options.domain).toBeUndefined();
    // __Host- プレフィックスは path="/" 必須のため絶対に崩さないこと。
    expect(cookies.csrfToken?.options.path).toBe("/");
  });

  test("ローカル開発 (http) では secure=false + プレフィックスなし", () => {
    const cookies = buildCookieOptions(false)!;

    expect(cookies.sessionToken?.name).toBe("next-auth.session-token");
    expect(cookies.sessionToken?.options.secure).toBe(false);
    expect(cookies.sessionToken?.options.domain).toBeUndefined();
    expect(cookies.sessionToken?.options.path).toBe("/");

    expect(cookies.callbackUrl?.name).toBe("next-auth.callback-url");
    expect(cookies.callbackUrl?.options.secure).toBe(false);
    expect(cookies.callbackUrl?.options.httpOnly).toBeUndefined();
    expect(cookies.callbackUrl?.options.path).toBe("/");

    expect(cookies.csrfToken?.name).toBe("next-auth.csrf-token");
    expect(cookies.csrfToken?.options.secure).toBe(false);
    expect(cookies.csrfToken?.options.domain).toBeUndefined();
    expect(cookies.csrfToken?.options.path).toBe("/");
  });
});
