/**
 * MockImageUploadService のテスト (Issue #120 / PR #155 レビュー対応)
 *
 * - production では構築自体が throw される
 * - 生成する `publicUrl` が `isAllowedImageUrl` allowlist に合致する
 * - fail-safe ガード: allowlist 外の URL を返すサブクラスでは uploadImage が reject
 */
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { isAllowedImageUrl } from "@physifun/ui-shared";
import { MockImageUploadService } from "../ImageUploadService";

describe("MockImageUploadService", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  // `NODE_ENV` は型定義上 readonly 相当のため Record キャストで書き換える。
  // `jest.replaceProperty` は bun test では未実装のため手動 backup/restore 方式を採用。
  const setNodeEnv = (value: string | undefined) => {
    const env = process.env as Record<string, string | undefined>;
    if (value === undefined) {
      delete env.NODE_ENV;
    } else {
      env.NODE_ENV = value;
    }
  };

  beforeEach(() => {
    setNodeEnv("test");
  });

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
  });

  describe("production guard", () => {
    it("NODE_ENV=production では構築時に throw する", () => {
      setNodeEnv("production");
      expect(() => new MockImageUploadService()).toThrow(
        /MockImageUploadService must not be used in production/
      );
    });

    it("NODE_ENV=development では構築できる", () => {
      setNodeEnv("development");
      expect(() => new MockImageUploadService()).not.toThrow();
    });

    it("NODE_ENV=test では構築できる", () => {
      expect(() => new MockImageUploadService()).not.toThrow();
    });
  });

  describe("allowlist compatibility", () => {
    it("uploadImage の publicUrl は isAllowedImageUrl に合致する", async () => {
      const svc = new MockImageUploadService();
      const result = await svc.uploadImage(
        { buffer: Buffer.from([]), name: "cover.png", type: "image/png" },
        "projects/123"
      );

      expect(result.publicUrl).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
      expect(isAllowedImageUrl(result.publicUrl)).toBe(true);
    });

    it("getPublicUrl も isAllowedImageUrl に合致する", () => {
      const svc = new MockImageUploadService();
      const url = svc.getPublicUrl("projects/123/abc.png");

      expect(url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
      expect(isAllowedImageUrl(url)).toBe(true);
    });
  });

  describe("fail-safe guard", () => {
    it("uploadImage が allowlist 外の URL を生成すると reject する", async () => {
      const svc = new MockImageUploadService();
      // private メソッド `buildMockPublicUrl` をランタイムで差し替え、
      // allowlist 外の URL を返すようにする（fail-safe ガード検証）。
      (svc as unknown as { buildMockPublicUrl: (p: string) => string }).buildMockPublicUrl = (
        path: string
      ) => `https://evil.example.com/${path}`;

      await expect(
        svc.uploadImage(
          { buffer: Buffer.from([]), name: "cover.png", type: "image/png" },
          "projects/999"
        )
      ).rejects.toThrow(/not in the image allowlist/);
    });
  });
});
