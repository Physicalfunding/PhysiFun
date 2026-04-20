import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { isAllowedImageUrl } from "../isAllowedImageUrl";

/**
 * Issue #120: カバー画像 URL allowlist + SSRF 防御のテスト。
 *
 * NODE_ENV / NEXT_PUBLIC_SUPABASE_URL を切り替えるため、
 * 各テスト前後で環境変数をバックアップ / 復元する。
 */
describe("isAllowedImageUrl", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    // 既定: production 相当（= 開発例外なし）
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
  });

  describe("allowlist (Supabase Storage)", () => {
    it("*.supabase.co の公開ストレージ URL は許可する", () => {
      expect(
        isAllowedImageUrl(
          "https://abcxyz.supabase.co/storage/v1/object/public/project-images/cover.png"
        )
      ).toBe(true);
    });

    it("サブドメインのない supabase.co 単体は拒否する", () => {
      expect(isAllowedImageUrl("https://supabase.co/image.png")).toBe(false);
    });

    it("supabase.co を含む異なるホスト（同名攻撃）は拒否する", () => {
      // 末尾一致ではなく「.supabase.co で終わる」かつサブドメインあり、で判定
      expect(isAllowedImageUrl("https://supabase.co.evil.com/image.png")).toBe(false);
      expect(isAllowedImageUrl("https://fakesupabase.co/image.png")).toBe(false);
    });

    it("Unsplash（モック画像）は許可する", () => {
      expect(isAllowedImageUrl("https://images.unsplash.com/photo-1.jpg")).toBe(true);
    });

    it("未知のホストは拒否する", () => {
      expect(isAllowedImageUrl("https://example.com/image.png")).toBe(false);
      expect(isAllowedImageUrl("https://evil.com/cover.jpg")).toBe(false);
    });
  });

  describe("scheme validation", () => {
    it("http は拒否する (Mixed Content 回避)", () => {
      expect(isAllowedImageUrl("http://abc.supabase.co/image.png")).toBe(false);
    });

    it("javascript: は拒否する", () => {
      expect(isAllowedImageUrl("javascript:alert(1)")).toBe(false);
    });

    it("data: は拒否する", () => {
      expect(isAllowedImageUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
    });

    it("file: は拒否する", () => {
      expect(isAllowedImageUrl("file:///etc/passwd")).toBe(false);
    });
  });

  describe("SSRF defense", () => {
    it("AWS/GCP メタデータエンドポイント 169.254.169.254 は拒否する", () => {
      expect(isAllowedImageUrl("https://169.254.169.254/latest/meta-data/")).toBe(false);
    });

    it("169.254.0.0/16 link-local は拒否する", () => {
      expect(isAllowedImageUrl("https://169.254.1.1/image.png")).toBe(false);
    });

    it("127.0.0.1 ループバックは拒否する（production）", () => {
      expect(isAllowedImageUrl("https://127.0.0.1/image.png")).toBe(false);
    });

    it("127.x.x.x ループバック全域を拒否する", () => {
      expect(isAllowedImageUrl("https://127.1.2.3/image.png")).toBe(false);
    });

    it("10.0.0.0/8 プライベート IP を拒否する", () => {
      expect(isAllowedImageUrl("https://10.0.0.1/image.png")).toBe(false);
      expect(isAllowedImageUrl("https://10.255.255.255/image.png")).toBe(false);
    });

    it("172.16.0.0/12 プライベート IP を拒否する", () => {
      expect(isAllowedImageUrl("https://172.16.0.1/image.png")).toBe(false);
      expect(isAllowedImageUrl("https://172.31.255.255/image.png")).toBe(false);
    });

    it("172.15.x や 172.32.x は RFC1918 外なのでホスト allowlist に従って拒否する", () => {
      // プライベートではないが、未知ホストなので allowlist で拒否される
      expect(isAllowedImageUrl("https://172.15.0.1/image.png")).toBe(false);
      expect(isAllowedImageUrl("https://172.32.0.1/image.png")).toBe(false);
    });

    it("192.168.0.0/16 プライベート IP を拒否する", () => {
      expect(isAllowedImageUrl("https://192.168.0.1/image.png")).toBe(false);
    });

    it("0.0.0.0 は拒否する", () => {
      expect(isAllowedImageUrl("https://0.0.0.0/image.png")).toBe(false);
    });

    it("IPv6 ループバック [::1] は拒否する", () => {
      expect(isAllowedImageUrl("https://[::1]/image.png")).toBe(false);
    });

    it("IPv6 unspecified [::] は拒否する", () => {
      expect(isAllowedImageUrl("https://[::]/image.png")).toBe(false);
    });

    it("IPv4-mapped IPv6 [::ffff:127.0.0.1] は拒否する", () => {
      expect(isAllowedImageUrl("https://[::ffff:127.0.0.1]/image.png")).toBe(false);
    });

    it("IPv4-mapped IPv6 [::ffff:169.254.169.254]（メタデータ）は拒否する", () => {
      expect(isAllowedImageUrl("https://[::ffff:169.254.169.254]/image.png")).toBe(false);
    });

    it("IPv4-mapped IPv6 16 進形式 [::ffff:7f00:1] も拒否する", () => {
      expect(isAllowedImageUrl("https://[::ffff:7f00:1]/image.png")).toBe(false);
    });

    it("IPv6 ULA fc00::/7 を拒否する", () => {
      expect(isAllowedImageUrl("https://[fc00::1]/image.png")).toBe(false);
      expect(isAllowedImageUrl("https://[fd12:3456:789a::1]/image.png")).toBe(false);
    });

    it("IPv6 link-local fe80::/10 を拒否する", () => {
      expect(isAllowedImageUrl("https://[fe80::1]/image.png")).toBe(false);
      expect(isAllowedImageUrl("https://[febf::1]/image.png")).toBe(false);
    });

    it("IPv6 link-local 境界外 (fec0::) は SSRF 判定しない（allowlist で落ちる）", () => {
      // fec0::/10 はサイトローカル（deprecated）。allowlist 未登録なので拒否されるが、
      // 本テストは IPv6 判定ロジックが過剰に広げていないことを確認する意図。
      expect(isAllowedImageUrl("https://[fec0::1]/image.png")).toBe(false);
    });
  });

  describe("port guard (production)", () => {
    it("非標準ポート :22 は拒否する", () => {
      expect(isAllowedImageUrl("https://abc.supabase.co:22/x.png")).toBe(false);
    });

    it("非標準ポート :8443 は拒否する", () => {
      expect(isAllowedImageUrl("https://abc.supabase.co:8443/x.png")).toBe(false);
    });

    it("ポート :0 は拒否する", () => {
      expect(isAllowedImageUrl("https://abc.supabase.co:0/x.png")).toBe(false);
    });

    it("明示 :443 は許可する", () => {
      expect(isAllowedImageUrl("https://abc.supabase.co:443/x.png")).toBe(true);
    });
  });

  describe("credentials embedded URL", () => {
    it("username:password 埋込 URL は拒否する", () => {
      expect(isAllowedImageUrl("https://user:pass@abc.supabase.co/x.png")).toBe(false);
    });

    it("username のみの埋込 URL も拒否する", () => {
      expect(isAllowedImageUrl("https://user@abc.supabase.co/x.png")).toBe(false);
    });

    it("@ 記号による同名攻撃（hostname が evil.com になる）は allowlist で拒否する", () => {
      expect(isAllowedImageUrl("https://abc.supabase.co@evil.com/x.png")).toBe(false);
    });
  });

  describe("Supabase subdomain depth", () => {
    it("多階層サブドメイン a.b.supabase.co は拒否する", () => {
      expect(isAllowedImageUrl("https://a.b.supabase.co/image.png")).toBe(false);
    });

    it("env の独自 Supabase ドメインは完全一致のみ許可（多階層は拒否）", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://custom-supabase.example.org";
      // 完全一致: OK
      expect(isAllowedImageUrl("https://custom-supabase.example.org/image.png")).toBe(true);
      // サブドメイン: 拒否
      expect(isAllowedImageUrl("https://sub.custom-supabase.example.org/image.png")).toBe(false);
    });
  });

  describe("unicode / IDN", () => {
    // `new URL` は IDN を NFKC 正規化して ASCII 化する。全角英字は半角英字に
    // 畳まれるため、結果として `abc.supabase.co` と同等に扱われる（= 許可）。
    // 本テストはその挙動を「意図して固定」する（変われば気付けるように）。
    it("全角英字 SUPABASE を含むホストは半角に正規化されて許可される", () => {
      expect(isAllowedImageUrl("https://abc.ＳＵＰＡＢＡＳＥ.co/image.png")).toBe(true);
    });

    it("xn-- を含む別ドメインは allowlist 一致しないので拒否する", () => {
      // サフィックスが `.supabase.co` でないので弾かれる
      expect(isAllowedImageUrl("https://xn--abc.supabase.co.example.com/image.png")).toBe(false);
    });
  });

  describe("URL parsing failures", () => {
    it("URL として不正な文字列は拒否する", () => {
      expect(isAllowedImageUrl("not-a-url")).toBe(false);
      expect(isAllowedImageUrl("")).toBe(false);
      expect(isAllowedImageUrl("   ")).toBe(false);
    });
  });

  describe("environment-dependent allowlist", () => {
    it("NEXT_PUBLIC_SUPABASE_URL のホストを動的に許可する", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://custom-supabase.example.org";
      expect(isAllowedImageUrl("https://custom-supabase.example.org/image.png")).toBe(true);
    });

    it("NEXT_PUBLIC_SUPABASE_URL が設定されていても別ホストは拒否する", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://custom-supabase.example.org";
      expect(isAllowedImageUrl("https://other.example.org/image.png")).toBe(false);
    });

    it("NEXT_PUBLIC_SUPABASE_URL が不正でもパース失敗を握りつぶし、allowlist 判定のみ行う", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
      expect(isAllowedImageUrl("https://abc.supabase.co/image.png")).toBe(true);
      expect(isAllowedImageUrl("https://evil.com/image.png")).toBe(false);
    });

    it("development 環境でのみ 127.0.0.1:54321 のローカル Supabase を許可する", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      expect(isAllowedImageUrl("http://127.0.0.1:54321/storage/v1/object/public/x.png")).toBe(true);
      expect(isAllowedImageUrl("http://localhost:54321/storage/v1/object/public/x.png")).toBe(true);
    });

    it("development でもポートが違えば拒否する（誤許可防止）", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      expect(isAllowedImageUrl("http://127.0.0.1:8080/x.png")).toBe(false);
    });

    it("production では localhost:54321 も拒否する", () => {
      expect(isAllowedImageUrl("http://127.0.0.1:54321/storage/v1/object/public/x.png")).toBe(
        false
      );
    });
  });
});
