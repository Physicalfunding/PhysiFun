/**
 * MockImageStorage のテスト（#120 / PR #155 の MockImageUploadService から #319 で移設）
 *
 * - production では構築自体が例外になる
 * - 公開 URL は Unsplash のホスト（`isAllowedImageUrl` が許す形）で、path を含む
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MockImageStorage } from "../ImageStorage";

describe("MockImageStorage", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  // `NODE_ENV` は型定義上 readonly 相当のため Record キャストで書き換え、手動で backup/restore する。
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

  it("NODE_ENV=production では構築時に例外になる", () => {
    setNodeEnv("production");
    expect(() => new MockImageStorage()).toThrow(/must not be used in production/);
  });

  it.each(["development", "test"])("NODE_ENV=%s では構築できる", (env) => {
    setNodeEnv(env);
    expect(() => new MockImageStorage()).not.toThrow();
  });

  it("upload の publicUrl は Unsplash の /photo- で始まり、path を含む", async () => {
    const storage = new MockImageStorage();
    const path = "projects/123/story/abc.png";

    const result = await storage.upload({
      path,
      bytes: new Uint8Array([0x89, 0x50]),
      contentType: "image/png",
    });

    expect(result.publicUrl).toBe(`https://images.unsplash.com/photo-mock/${path}`);
    expect(result.publicUrl).toBe(storage.getPublicUrl(path));
  });
});
