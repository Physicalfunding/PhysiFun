import { describe, it, expect } from "@jest/globals";
import { createSendAdminMagicLink } from "../sendAdminMagicLink";
import {
  MAGIC_LINK_SIGNATURE_PARAM,
  computeMagicLinkSignature,
} from "../magicLinkHmac";
import type { MailMessage, MailSender, MailSendError } from "../../mail/types";
import type { SendVerificationRequestParams } from "next-auth/providers/email";
import type { Result } from "@physifun/domain";

/**
 * sendAdminMagicLink ユニットテスト (#146)
 *
 * 本テストでは NextAuth の SendVerificationRequestParams を組み立てて
 * `createSendAdminMagicLink` を実行し、
 *   - MailSender に渡す URL に `sig` と `sig_exp` が付与されていること
 *   - 付与された署名が `computeMagicLinkSignature` と一致すること
 *   - 本文 (text / html) にも signed URL が反映されていること
 * を確認する。
 */

const HMAC_SECRET = "x".repeat(64);

function createCapturingMailSender(): {
  sender: MailSender;
  captured: { message: MailMessage | null };
} {
  const captured: { message: MailMessage | null } = { message: null };
  const sender: MailSender = {
    async send(msg: MailMessage): Promise<Result<void, MailSendError>> {
      captured.message = msg;
      return { ok: true, value: undefined };
    },
  };
  return { sender, captured };
}

function createParams(overrides?: Partial<SendVerificationRequestParams>): SendVerificationRequestParams {
  const base: Partial<SendVerificationRequestParams> = {
    identifier: "alice@example.com",
    url: "https://admin.example.com/api/auth/callback/email?callbackUrl=%2F&token=tok_abcdef1234567890&email=alice%40example.com",
    expires: new Date("2026-04-22T00:10:00.000Z"),
    token: "tok_abcdef1234567890",
    ...overrides,
  };
  return base as SendVerificationRequestParams;
}

describe("createSendAdminMagicLink (#146)", () => {
  it("URL に HMAC sig と sig_exp を付与してメール送信する", async () => {
    const { sender, captured } = createCapturingMailSender();
    const send = createSendAdminMagicLink({
      mailSender: sender,
      expiresInMin: 10,
      hmacSecret: HMAC_SECRET,
    });

    const params = createParams();
    await send(params);

    expect(captured.message).not.toBeNull();
    const text = captured.message!.text ?? "";
    // text/html の中に signed URL が出現する
    const urlMatch = text.match(/https:\/\/admin\.example\.com\/api\/auth\/callback\/email[^\s]+/);
    expect(urlMatch).not.toBeNull();
    const signedUrl = new URL(urlMatch![0]);
    expect(signedUrl.searchParams.get(MAGIC_LINK_SIGNATURE_PARAM)).toBeTruthy();
    expect(signedUrl.searchParams.get("sig_exp")).toBe(String(params.expires.getTime()));

    // 署名値が HMAC と一致すること
    const expected = computeMagicLinkSignature({
      email: params.identifier,
      token: "tok_abcdef1234567890",
      expires: params.expires.getTime(),
      secret: HMAC_SECRET,
    });
    expect(signedUrl.searchParams.get(MAGIC_LINK_SIGNATURE_PARAM)).toBe(expected);
  });

  it("javascript: スキームなど http(s) 以外の URL は throw する (#157 H1 との併存)", async () => {
    const { sender } = createCapturingMailSender();
    const send = createSendAdminMagicLink({
      mailSender: sender,
      expiresInMin: 10,
      hmacSecret: HMAC_SECRET,
    });
    const params = createParams({ url: "javascript:alert(1)" });
    await expect(send(params)).rejects.toThrow(/disallowed URL scheme/);
  });

  it("MailSender が失敗した場合は throw する", async () => {
    const sender: MailSender = {
      async send(): Promise<Result<void, MailSendError>> {
        return {
          ok: false,
          error: { message: "boom", retriable: false },
        };
      },
    };
    const send = createSendAdminMagicLink({
      mailSender: sender,
      expiresInMin: 10,
      hmacSecret: HMAC_SECRET,
    });
    await expect(send(createParams())).rejects.toThrow(/mail send failed/);
  });
});
