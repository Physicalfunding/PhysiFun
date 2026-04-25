import { describe, it, expect } from "@jest/globals";
import {
  buildMagicLinkHmacPayload,
  computeMagicLinkSignature,
  signMagicLinkUrl,
  verifyMagicLinkSignature,
  getAdminMagicLinkHmacSecret,
  MAGIC_LINK_SIGNATURE_PARAM,
} from "../magicLinkHmac";

/**
 * Magic Link HMAC 検証ユニットテスト (#146)
 *
 * - 署名生成の determinism / canonical 性
 * - URL への sig / sig_exp 埋め込み
 * - 改ざん検出 (token / email / expires / sig)
 * - timingSafeEqual 比較の挙動 (length mismatch / mismatch)
 * - getAdminMagicLinkHmacSecret の fail closed 動作
 */

const SECRET = "a".repeat(64); // 十分な長さのダミー secret
const OTHER_SECRET = "b".repeat(64);

const fixedEmail = "alice@example.com";
const fixedToken = "tok_abcdef1234567890";
const fixedExpires = new Date("2026-04-22T00:10:00.000Z");
const fixedExpiresMs = fixedExpires.getTime();

describe("buildMagicLinkHmacPayload", () => {
  it("email / token / expires を改行区切りで連結する", () => {
    const p = buildMagicLinkHmacPayload({
      email: fixedEmail,
      token: fixedToken,
      expires: fixedExpiresMs,
    });
    expect(p).toBe(`${fixedEmail}\n${fixedToken}\n${fixedExpiresMs}`);
  });

  it("email は trim + lowercase に正規化される", () => {
    const p = buildMagicLinkHmacPayload({
      email: "  Alice@Example.COM ",
      token: fixedToken,
      expires: fixedExpiresMs,
    });
    expect(p).toBe(`${fixedEmail}\n${fixedToken}\n${fixedExpiresMs}`);
  });
});

describe("computeMagicLinkSignature", () => {
  it("同じ入力 + 同じ secret なら決定的に同じ署名を返す", () => {
    const s1 = computeMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      expires: fixedExpiresMs,
      secret: SECRET,
    });
    const s2 = computeMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      expires: fixedExpiresMs,
      secret: SECRET,
    });
    expect(s1).toBe(s2);
    // base64url (no padding) の文字集合
    expect(s1).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("secret が違えば署名が変わる", () => {
    const s1 = computeMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      expires: fixedExpiresMs,
      secret: SECRET,
    });
    const s2 = computeMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      expires: fixedExpiresMs,
      secret: OTHER_SECRET,
    });
    expect(s1).not.toBe(s2);
  });

  it("空 secret は即 throw (fail closed)", () => {
    expect(() =>
      computeMagicLinkSignature({
        email: fixedEmail,
        token: fixedToken,
        expires: fixedExpiresMs,
        secret: "",
      })
    ).toThrow(/secret must not be empty/);
  });
});

describe("signMagicLinkUrl", () => {
  const baseUrl =
    "https://admin.example.com/api/auth/callback/email?callbackUrl=%2F&token=tok_abcdef1234567890&email=alice%40example.com";

  it("sig と sig_exp クエリを付与して既存クエリを破壊しない", () => {
    const signed = signMagicLinkUrl({
      url: baseUrl,
      email: fixedEmail,
      token: fixedToken,
      expires: fixedExpires,
      secret: SECRET,
    });
    const u = new URL(signed);
    expect(u.searchParams.get(MAGIC_LINK_SIGNATURE_PARAM)).toBeTruthy();
    expect(u.searchParams.get("sig_exp")).toBe(String(fixedExpiresMs));
    // 既存クエリが保持される
    expect(u.searchParams.get("token")).toBe(fixedToken);
    expect(u.searchParams.get("email")).toBe(fixedEmail);
    expect(u.searchParams.get("callbackUrl")).toBe("/");
  });

  it("既存 sig を上書きする", () => {
    const withFake = `${baseUrl}&sig=deadbeef&sig_exp=999`;
    const signed = signMagicLinkUrl({
      url: withFake,
      email: fixedEmail,
      token: fixedToken,
      expires: fixedExpires,
      secret: SECRET,
    });
    const u = new URL(signed);
    expect(u.searchParams.get(MAGIC_LINK_SIGNATURE_PARAM)).not.toBe("deadbeef");
    expect(u.searchParams.get("sig_exp")).toBe(String(fixedExpiresMs));
  });
});

describe("verifyMagicLinkSignature", () => {
  const validSig = computeMagicLinkSignature({
    email: fixedEmail,
    token: fixedToken,
    expires: fixedExpiresMs,
    secret: SECRET,
  });

  it("正しい sig + email + token + sig_exp なら ok=true", () => {
    const r = verifyMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      sig: validSig,
      sigExpires: String(fixedExpiresMs),
      secret: SECRET,
    });
    expect(r.ok).toBe(true);
  });

  it("sig が欠けていれば missing_signature", () => {
    const r = verifyMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      sig: null,
      sigExpires: String(fixedExpiresMs),
      secret: SECRET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_signature");
  });

  it("sig_exp が欠けていれば missing_expires", () => {
    const r = verifyMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      sig: validSig,
      sigExpires: null,
      secret: SECRET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_expires");
  });

  it("sig_exp が数値でなければ missing_expires", () => {
    const r = verifyMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      sig: validSig,
      sigExpires: "not-a-number",
      secret: SECRET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_expires");
  });

  it("token が改ざんされれば signature_mismatch", () => {
    const r = verifyMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken + "x",
      sig: validSig,
      sigExpires: String(fixedExpiresMs),
      secret: SECRET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("signature_mismatch");
  });

  it("email が改ざんされれば signature_mismatch", () => {
    const r = verifyMagicLinkSignature({
      email: "bob@example.com",
      token: fixedToken,
      sig: validSig,
      sigExpires: String(fixedExpiresMs),
      secret: SECRET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("signature_mismatch");
  });

  it("sig_exp が改ざんされれば signature_mismatch", () => {
    const r = verifyMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      sig: validSig,
      sigExpires: String(fixedExpiresMs + 1),
      secret: SECRET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("signature_mismatch");
  });

  it("secret が違えば signature_mismatch (別 secret で署名しても通らない)", () => {
    const r = verifyMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      sig: validSig,
      sigExpires: String(fixedExpiresMs),
      secret: OTHER_SECRET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("signature_mismatch");
  });

  it("sig の長さが異なれば length_mismatch", () => {
    const r = verifyMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      sig: "short",
      sigExpires: String(fixedExpiresMs),
      secret: SECRET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("length_mismatch");
  });

  // #172: Buffer.from(str, "base64url") は不正文字を例外なく無視してデコードするため、
  // 旧 `invalid_encoding` reason は到達不可能な dead code だった。
  // 実挙動として `length_mismatch` / `signature_mismatch` のいずれかに落ちることを担保する。
  it("base64url として不正文字を含む短い sig は length_mismatch に落ちる", () => {
    const r = verifyMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      // `!` / `@` などは base64url の文字集合 (A-Z a-z 0-9 _ -) に含まれないため無視される。
      // 結果として expected より短いバッファになり length_mismatch で弾かれる。
      sig: "!!!invalid-base64url!!!",
      sigExpires: String(fixedExpiresMs),
      secret: SECRET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("length_mismatch");
  });

  it("有効な base64url 文字だけで expected と同じ長さの不正 sig は signature_mismatch に落ちる", () => {
    // expected と同じバイト長 (HMAC-SHA256 = 32 byte → base64url 43 文字) にそろえる。
    const expected = computeMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      expires: fixedExpiresMs,
      secret: SECRET,
    });
    const bogus = "A".repeat(expected.length);
    const r = verifyMagicLinkSignature({
      email: fixedEmail,
      token: fixedToken,
      sig: bogus,
      sigExpires: String(fixedExpiresMs),
      secret: SECRET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("signature_mismatch");
  });

  it("signMagicLinkUrl → verifyMagicLinkSignature のラウンドトリップが成立する", () => {
    const baseUrl =
      "https://admin.example.com/api/auth/callback/email?callbackUrl=%2F&token=tok_abcdef1234567890&email=alice%40example.com";
    const signed = signMagicLinkUrl({
      url: baseUrl,
      email: fixedEmail,
      token: fixedToken,
      expires: fixedExpires,
      secret: SECRET,
    });
    const u = new URL(signed);
    const result = verifyMagicLinkSignature({
      email: u.searchParams.get("email") ?? "",
      token: u.searchParams.get("token") ?? "",
      sig: u.searchParams.get(MAGIC_LINK_SIGNATURE_PARAM),
      sigExpires: u.searchParams.get("sig_exp"),
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
  });
});

describe("getAdminMagicLinkHmacSecret", () => {
  // NodeJS.ProcessEnv は NODE_ENV を必須扱いするため、unknown 経由でキャストする。
  const asEnv = (e: Record<string, string>): NodeJS.ProcessEnv =>
    e as unknown as NodeJS.ProcessEnv;

  it("ADMIN_MAGIC_LINK_HMAC_SECRET が設定されていれば返す", () => {
    expect(getAdminMagicLinkHmacSecret(asEnv({ ADMIN_MAGIC_LINK_HMAC_SECRET: SECRET }))).toBe(
      SECRET
    );
  });

  it("未設定なら fail closed で throw", () => {
    expect(() => getAdminMagicLinkHmacSecret(asEnv({}))).toThrow(
      /ADMIN_MAGIC_LINK_HMAC_SECRET is not set/
    );
  });

  it("空文字なら fail closed で throw", () => {
    expect(() =>
      getAdminMagicLinkHmacSecret(asEnv({ ADMIN_MAGIC_LINK_HMAC_SECRET: "" }))
    ).toThrow(/ADMIN_MAGIC_LINK_HMAC_SECRET is not set/);
  });

  it("NEXTAUTH_SECRET と同一値なら throw (権限分離強制)", () => {
    expect(() =>
      getAdminMagicLinkHmacSecret(
        asEnv({
          ADMIN_MAGIC_LINK_HMAC_SECRET: SECRET,
          NEXTAUTH_SECRET: SECRET,
        })
      )
    ).toThrow(/must differ from NEXTAUTH_SECRET/);
  });
});
