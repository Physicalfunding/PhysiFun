/**
 * Cloudflare Turnstile CAPTCHA 検証 (Issue #200)
 *
 * Turnstile siteverify API を呼び出してトークンを検証する。
 * - エンドポイント: `https://challenges.cloudflare.com/turnstile/v0/siteverify`
 * - 必須環境変数: `TURNSTILE_SECRET_KEY`（サーバー側）
 * - サイトキー: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`（クライアント側、widget 描画用）
 *
 * `TURNSTILE_SECRET_KEY` 未設定時の挙動はテスタビリティと開発体験のため二段構え：
 * - production: 設定必須。未設定なら検証エラーで弾く（fail-closed）。
 * - production 以外（development / test）: 警告ログを出して検証パス（fail-open）。
 *   ローカル開発で Cloudflare アカウントなしでも /apply を試せるようにするため。
 *
 * UseCase からは DI 経由で `CaptchaVerifierPort` として注入する。
 */

import type { CaptchaVerifierPort } from "@physifun/application";
import { err, ok } from "@physifun/domain";

const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * siteverify 呼び出しのタイムアウト (ms)。
 * Cloudflare 側が応答しない場合に応募 API がハングしないよう短めに切る。
 */
const TURNSTILE_SITEVERIFY_TIMEOUT_MS = 5_000;

/**
 * Turnstile siteverify API のレスポンス（必要な部分のみ）
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
interface TurnstileSiteverifyResponse {
  success: boolean;
  "error-codes"?: readonly string[];
}

/**
 * Turnstile に基づく CaptchaVerifierPort 実装を生成する。
 *
 * `TURNSTILE_SECRET_KEY` が未設定の場合：
 * - `NODE_ENV === "production"`: CAPTCHA_VERIFICATION_FAILED で弾く
 * - それ以外: 警告ログを出してパス（ローカル開発向けの fallback）
 *
 * 起動時アサーション (Issue #200 / PR #201 review L-1):
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` がフロント側でセット済みなのに
 * `TURNSTILE_SECRET_KEY` がサーバー側で未設定だと、クライアントは本物の
 * Turnstile トークンを送るがサーバーが検証をスキップしてしまう。これは
 * NODE_ENV に依存しない明確な設定ミスなので、ここで早期に throw して
 * デプロイを失敗させる。
 */
export function createTurnstileCaptchaVerifier(): CaptchaVerifierPort {
  const siteKeyAtInit = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const secretAtInit = process.env.TURNSTILE_SECRET_KEY;
  if (siteKeyAtInit && !secretAtInit) {
    throw new Error(
      "[captcha] Misconfiguration: NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing. " +
        "This would cause the server to bypass CAPTCHA verification while the client sends real tokens."
    );
  }

  return {
    async verify({ token, remoteIp }) {
      const secret = process.env.TURNSTILE_SECRET_KEY;
      if (!secret) {
        if (process.env.NODE_ENV === "production") {
          console.error("[captcha] TURNSTILE_SECRET_KEY is not set in production");
          return err({ type: "CAPTCHA_VERIFICATION_FAILED" });
        }
        console.warn(
          "[captcha] TURNSTILE_SECRET_KEY is not set; bypassing verification (non-production)"
        );
        return ok(undefined);
      }

      const params = new URLSearchParams();
      params.set("secret", secret);
      params.set("response", token);
      if (remoteIp) params.set("remoteip", remoteIp);

      try {
        const res = await fetch(TURNSTILE_SITEVERIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
          signal: AbortSignal.timeout(TURNSTILE_SITEVERIFY_TIMEOUT_MS),
        });
        if (!res.ok) {
          console.error("[captcha] siteverify HTTP error:", res.status);
          return err({ type: "CAPTCHA_VERIFICATION_FAILED" });
        }
        const data = (await res.json()) as TurnstileSiteverifyResponse;
        if (!data.success) {
          console.warn("[captcha] siteverify rejected token:", data["error-codes"]);
          return err({ type: "CAPTCHA_VERIFICATION_FAILED" });
        }
        return ok(undefined);
      } catch (e) {
        console.error("[captcha] siteverify fetch failed:", e);
        return err({ type: "CAPTCHA_VERIFICATION_FAILED" });
      }
    },
  };
}
