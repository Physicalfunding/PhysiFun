import { describe, expect, it, vi } from "vitest";
import { ProjectId } from "@physifun/domain";

/**
 * `getIsAllowedStoryImageUrl` が置き場所を 1 度だけ作ることのテスト（#319。Claude のレビュー指摘）
 *
 * 本文に画像が 20 枚あれば判定は 20 回呼ばれる。そのたびに Supabase クライアントを作り直さないことを確かめる。
 */
const createImageStorage = vi.fn(() => ({
  getPublicUrl: (path: string) => `https://abc.supabase.co/project-images/${path}`,
  upload: async () => ({ publicUrl: "" }),
}));
vi.mock("@physifun/infrastructure", () => ({
  createImageStorage: () => createImageStorage(),
  findProjectOwner: async () => null,
}));

import { getIsAllowedStoryImageUrl } from "../story-image";

describe("getIsAllowedStoryImageUrl（遅延生成）", () => {
  it("判定を何回呼んでも、置き場所は最初の 1 回だけ作る", () => {
    const r = ProjectId.from("00000000-0000-4000-b000-000000000001");
    if (!r.ok) throw new Error("ProjectId creation failed");
    const isAllowed = getIsAllowedStoryImageUrl();
    expect(createImageStorage).not.toHaveBeenCalled();

    for (let i = 0; i < 3; i++) {
      isAllowed(
        `https://abc.supabase.co/project-images/projects/${r.value}/story/${i}.png`,
        r.value
      );
    }

    expect(createImageStorage).toHaveBeenCalledTimes(1);
  });
});
