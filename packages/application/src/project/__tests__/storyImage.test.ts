import { describe, it, expect } from "vitest";
import { ProjectId } from "@physifun/domain";
import {
  createIsAllowedStoryImageUrl,
  detectStoryImageFormat,
  storyImageFolder,
} from "../storyImage";

const PROJECT_ID_STR = "00000000-0000-4000-b000-000000000001";
const OTHER_PROJECT_ID_STR = "00000000-0000-4000-b000-000000000002";

function projectId(value: string): ProjectId {
  const r = ProjectId.from(value);
  if (!r.ok) throw new Error("ProjectId creation failed");
  return r.value;
}

/** 先頭バイトのあとに適当な中身を足す（判定が先頭だけを見ることの確認も兼ねる） */
const withBody = (head: number[]) => new Uint8Array([...head, 0x00, 0x01, 0x02, 0x03]);

describe("detectStoryImageFormat", () => {
  it.each([
    ["JPEG", withBody([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    ["PNG", withBody([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"],
    [
      "WebP",
      new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
      "image/webp",
    ],
  ])("%s の先頭バイトを判定できる", (_, bytes, expected) => {
    expect(detectStoryImageFormat(bytes)).toBe(expected);
  });

  it.each([
    ["GIF", new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
    ["文字（PNG の名前で送られた偽装を想定）", new TextEncoder().encode("<svg>not an image</svg>")],
    [
      "RIFF だが WebP でない（WAV）",
      new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]),
    ],
    ["途中で切れた PNG", new Uint8Array([0x89, 0x50, 0x4e])],
    ["空", new Uint8Array([])],
  ])("%sは null", (_, bytes) => {
    expect(detectStoryImageFormat(bytes)).toBeNull();
  });
});

describe("createIsAllowedStoryImageUrl", () => {
  const storage = {
    getPublicUrl: (path: string) =>
      `https://abc.supabase.co/storage/v1/object/public/project-images/${path}`,
  };
  const isAllowed = createIsAllowedStoryImageUrl(storage, (url) => url.startsWith("https://"));
  const own = projectId(PROJECT_ID_STR);

  it("フォルダは projects/{projectId}/story", () => {
    expect(storyImageFolder(own)).toBe(`projects/${PROJECT_ID_STR}/story`);
  });

  it("そのプロジェクトのストーリー用フォルダの画像は許す", () => {
    expect(isAllowed(storage.getPublicUrl(`${storyImageFolder(own)}/a.png`), own)).toBe(true);
  });

  it.each([
    ["別のプロジェクトのフォルダ", `projects/${OTHER_PROJECT_ID_STR}/story/a.png`],
    ["同じプロジェクトでも別のフォルダ", `projects/${PROJECT_ID_STR}/cover/a.png`],
    ["フォルダ名が前方一致するだけ", `projects/${PROJECT_ID_STR}/story-old/a.png`],
  ])("%sの画像は断る", (_, path) => {
    expect(isAllowed(storage.getPublicUrl(path), own)).toBe(false);
  });

  it("フォルダが合っていても isAllowedImageUrl が断れば断る", () => {
    const strict = createIsAllowedStoryImageUrl(storage, () => false);
    expect(strict(storage.getPublicUrl(`${storyImageFolder(own)}/a.png`), own)).toBe(false);
  });

  it("別のホストは断る", () => {
    expect(
      isAllowed(`https://evil.example.com/project-images/${storyImageFolder(own)}/a.png`, own)
    ).toBe(false);
  });
});
