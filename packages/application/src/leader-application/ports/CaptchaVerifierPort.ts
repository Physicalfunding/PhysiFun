import type { Result } from "@physifun/domain";

/**
 * CAPTCHA トークン検証ポート (Issue #200)
 *
 * 実装は apps/web 側で Cloudflare Turnstile siteverify を呼ぶ。
 * テストでは固定値を返すフェイクで差し替える。
 */
export interface CaptchaVerifierPort {
  verify(input: {
    token: string;
    /** クライアントの IP（Turnstile API のオプション引数 `remoteip` に使う） */
    remoteIp: string;
  }): Promise<Result<void, { type: "CAPTCHA_VERIFICATION_FAILED" }>>;
}
