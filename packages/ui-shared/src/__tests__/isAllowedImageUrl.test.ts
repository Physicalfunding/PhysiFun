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
