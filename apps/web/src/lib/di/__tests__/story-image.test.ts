/**
 * `getIsAllowedStoryImageUrl` のテスト（#319。Codex のレビュー指摘）
 *
 * Supabase が未設定の本番では `createImageStorage()` がモックの本番ガードで例外になる。
 * それでも、本文に画像が無い更新（タイトルだけの PATCH など）が巻き添えで 500 にならないよう、
 * 置き場所は画像 URL の判定が実際に呼ばれるまで作らないことを確かめる。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectId } from "@physifun/domain";
import { getIsAllowedStoryImageUrl } from "../story-image";

const PROJECT_ID = "00000000-0000-4000-b000-000000000001";

function projectId(): ProjectId {
  const r = ProjectId.from(PROJECT_ID);
  if (!r.ok) throw new Error("ProjectId creation failed");
  return r.value;
}

describe("getIsAllowedStoryImageUrl", () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = {
    NODE_ENV: env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  beforeEach(() => {
    delete env.NEXT_PUBLIC_SUPABASE_URL;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  });

  it("Supabase 未設定の本番でも、判定関数を作るだけでは例外にならない", () => {
    env.NODE_ENV = "production";
    expect(() => getIsAllowedStoryImageUrl()).not.toThrow();
  });

  it("Supabase 未設定の本番で画像 URL を判定しようとすると、そこで初めて例外になる", () => {
    env.NODE_ENV = "production";
    const isAllowed = getIsAllowedStoryImageUrl();
    expect(() => isAllowed("https://abc.supabase.co/x.png", projectId())).toThrow(
      /must not be used in production/
    );
  });

  it("Supabase 未設定のテスト環境ではモックの置き場所で判定する", () => {
    env.NODE_ENV = "test";
    const isAllowed = getIsAllowedStoryImageUrl();
    const own = `https://images.unsplash.com/photo-mock/projects/${PROJECT_ID}/story/a.png`;
    expect(isAllowed(own, projectId())).toBe(true);
    expect(isAllowed("https://images.unsplash.com/photo-other/a.png", projectId())).toBe(false);
  });
});
