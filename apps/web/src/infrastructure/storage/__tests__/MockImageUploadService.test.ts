/**
 * MockImageUploadService のテスト (Issue #120 / PR #155 レビュー対応)
 *
 * - production では構築自体が throw される
 * - 生成する `publicUrl` が `isAllowedImageUrl` allowlist に合致する
 * - fail-safe ガード: allowlist 外の URL を返すサブクラスでは uploadImage が reject
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { isAllowedImageUrl } from "@physifun/ui-shared";
import { MockImageUploadService } from "../ImageUploadService";

describe("MockImageUploadService", () => {
  beforeEach(() => {
    // production 以外の既定状態にしておく（jest.replaceProperty で自動復元）
    jest.replaceProperty(process.env, "NODE_ENV", "test");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("production guard", () => {
    it("NODE_ENV=production では構築時に throw する", () => {
      jest.replaceProperty(process.env, "NODE_ENV", "production");
      expect(() => new MockImageUploadService()).toThrow(
        /MockImageUploadService must not be used in production/
      );
    });

    it("NODE_ENV=development では構築できる", () => {
      jest.replaceProperty(process.env, "NODE_ENV", "development");
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
      // buildMockPublicUrl をサブクラスでオーバーライドして allowlist 外の
      // URL を返すようにする（private を型で緩めつつ上書き）。
      class BrokenMock extends MockImageUploadService {
        // @ts-expect-error override private method for test
        protected buildMockPublicUrl(path: string): string {
          return `https://evil.example.com/${path}`;
        }
      }
      const svc = new BrokenMock();

      await expect(
        svc.uploadImage(
          { buffer: Buffer.from([]), name: "cover.png", type: "image/png" },
          "projects/999"
        )
      ).rejects.toThrow(/not in the image allowlist/);
    });
  });
});
