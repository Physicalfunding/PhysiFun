import { PROJECT_STORY_LIMITS } from "@physifun/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STORY_IMAGE_JPEG_QUALITY,
  STORY_IMAGE_JPEG_QUALITY_RETRY,
  planStoryImageEncoding,
  prepareStoryImage,
  storyImageErrorMessage,
} from "../storyImageFile";

/**
 * Issue #320: ブラウザでの画像の縮小。
 *
 * - 判断（`planStoryImageEncoding`）は純関数なのでそのまま確かめる
 * - ブラウザの処理（`prepareStoryImage`）は、`Image`・`URL.createObjectURL`・canvas を最小限の偽物に差し替えて、
 *   読めないときのエラー・やり直し・上限超えの流れを確かめる（実際の縮小の画質はブラウザで確かめる）
 */

const EDGE = PROJECT_STORY_LIMITS.imageLongEdge;
const MAX = PROJECT_STORY_LIMITS.imageBytes;

describe("planStoryImageEncoding", () => {
  it("辺・大きさ・形式がすべて範囲内なら、画質を落とさないようそのまま送る", () => {
    for (const type of PROJECT_STORY_LIMITS.imageTypes) {
      expect(planStoryImageEncoding({ width: EDGE, height: 1000, type, size: MAX })).toEqual({
        kind: "original",
      });
    }
  });

  it("長い辺が上限を超えていれば、縦横比を保って上限まで縮める（横長・縦長）", () => {
    expect(
      planStoryImageEncoding({ width: 4000, height: 3000, type: "image/jpeg", size: 10_000_000 })
    ).toEqual({ kind: "encode", width: EDGE, height: 1500, type: "image/jpeg", quality: 0.85 });
    expect(
      planStoryImageEncoding({ width: 3000, height: 4000, type: "image/jpeg", size: 10_000_000 })
    ).toEqual({ kind: "encode", width: 1500, height: EDGE, type: "image/jpeg", quality: 0.85 });
  });

  it("縮めたあとの辺は丸めて 1 以上にする（極端に細長い画像でも 0 にならない）", () => {
    const plan = planStoryImageEncoding({ width: 10000, height: 1, type: "image/jpeg", size: 1 });
    expect(plan).toMatchObject({ kind: "encode", width: EDGE, height: 1 });
  });

  it("辺が範囲内でも、大きさが上限を超えていれば同じ辺で書き直す", () => {
    expect(
      planStoryImageEncoding({ width: 1200, height: 800, type: "image/jpeg", size: MAX + 1 })
    ).toEqual({ kind: "encode", width: 1200, height: 800, type: "image/jpeg", quality: 0.85 });
  });

  it("PNG は透過を残すため PNG のまま。WebP やブラウザが読めた他の形式（GIF・申告なし）は JPEG にする", () => {
    const big = { width: 3000, height: 3000, size: 1 };
    expect(planStoryImageEncoding({ ...big, type: "image/png" })).toMatchObject({
      type: "image/png",
    });
    expect(planStoryImageEncoding({ ...big, type: "image/webp" })).toMatchObject({
      type: "image/jpeg",
    });
    // 送れない形式は辺が小さくても書き直す（サーバーは JPEG / PNG / WebP しか受けない）
    expect(planStoryImageEncoding({ width: 100, height: 100, type: "image/gif", size: 1 })).toEqual(
      { kind: "encode", width: 100, height: 100, type: "image/jpeg", quality: 0.85 }
    );
    expect(planStoryImageEncoding({ width: 100, height: 100, type: "", size: 1 })).toMatchObject({
      kind: "encode",
      type: "image/jpeg",
    });
  });

  it("画質の定数は 0〜1 で、やり直しのほうが低い", () => {
    expect(STORY_IMAGE_JPEG_QUALITY).toBeGreaterThan(STORY_IMAGE_JPEG_QUALITY_RETRY);
    expect(STORY_IMAGE_JPEG_QUALITY).toBeLessThanOrEqual(1);
    expect(STORY_IMAGE_JPEG_QUALITY_RETRY).toBeGreaterThan(0);
  });
});

/**
 * ブラウザの最小限の偽物。`Image` はファイル名に `broken` を含むと読めない。
 * canvas の `toBlob` は、`encodedSizes` の先頭から順に、その大きさの Blob を返す
 * （`blobType` を渡すと、頼まれた形式ではなくその形式の Blob を返す。ブラウザがその形式で書けないときの振る舞い）
 */
function stubBrowser(options: {
  width: number;
  height: number;
  encodedSizes: number[];
  blobType?: string;
}) {
  const calls: { type: string; quality: number | undefined }[] = [];
  const revoked: string[] = [];
  let currentFile: File | null = null;

  class FakeImage {
    naturalWidth = options.width;
    naturalHeight = options.height;
    src = "";
    async decode() {
      if (currentFile?.name.includes("broken")) throw new Error("EncodingError");
    }
  }
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("URL", {
    createObjectURL: (file: File) => {
      currentFile = file;
      return `blob:${file.name}`;
    },
    revokeObjectURL: (url: string) => revoked.push(url),
  });
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => undefined }),
      toBlob: (callback: (blob: Blob | null) => void, type: string, quality?: number) => {
        calls.push({ type, quality });
        const size = options.encodedSizes.shift();
        callback(
          size === undefined
            ? null
            : new Blob([new Uint8Array(size)], { type: options.blobType ?? type })
        );
      },
    }),
  });
  return { calls, revoked };
}

describe("prepareStoryImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("範囲内のファイルはそのまま返す（書き直さない）", async () => {
    const { calls, revoked } = stubBrowser({ width: 800, height: 600, encodedSizes: [] });
    const file = new File([new Uint8Array(100)], "photo.jpg", { type: "image/jpeg" });
    const result = await prepareStoryImage(file);
    expect(result).toEqual({ ok: true, value: file });
    expect(calls).toEqual([]);
    expect(revoked).toEqual(["blob:photo.jpg"]);
  });

  it("ブラウザが読めないファイルは UNREADABLE", async () => {
    const { revoked } = stubBrowser({ width: 0, height: 0, encodedSizes: [] });
    const result = await prepareStoryImage(new File([""], "broken.heic", { type: "image/heic" }));
    expect(result).toEqual({ ok: false, error: { type: "UNREADABLE" } });
    expect(revoked).toEqual(["blob:broken.heic"]);
  });

  it("大きい写真は縮めて JPEG に書き直す", async () => {
    const { calls } = stubBrowser({ width: 4000, height: 3000, encodedSizes: [1000] });
    const file = new File([new Uint8Array(100)], "big.jpg", { type: "image/jpeg" });
    const result = await prepareStoryImage(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBe(file);
    expect(result.value.type).toBe("image/jpeg");
    expect(calls).toEqual([{ type: "image/jpeg", quality: STORY_IMAGE_JPEG_QUALITY }]);
  });

  it("書き直しても上限を超えたら、JPEG の画質を下げて 1 回やり直す（PNG でも JPEG にする）", async () => {
    const { calls } = stubBrowser({ width: 3000, height: 3000, encodedSizes: [MAX + 1, 500] });
    const result = await prepareStoryImage(new File([""], "big.png", { type: "image/png" }));
    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      { type: "image/png", quality: STORY_IMAGE_JPEG_QUALITY },
      { type: "image/jpeg", quality: STORY_IMAGE_JPEG_QUALITY_RETRY },
    ]);
  });

  it("やり直しても上限を超えたら TOO_LARGE", async () => {
    stubBrowser({ width: 3000, height: 3000, encodedSizes: [MAX + 1, MAX + 1] });
    const result = await prepareStoryImage(new File([""], "huge.jpg", { type: "image/jpeg" }));
    expect(result).toEqual({ ok: false, error: { type: "TOO_LARGE", maxBytes: MAX } });
  });

  it("ブラウザが書き直せないとき（toBlob が null）は ENCODE_FAILED", async () => {
    stubBrowser({ width: 3000, height: 3000, encodedSizes: [] });
    const result = await prepareStoryImage(new File([""], "big.jpg", { type: "image/jpeg" }));
    expect(result).toEqual({ ok: false, error: { type: "ENCODE_FAILED" } });
  });

  it("ブラウザが頼んだ形式で書けず別の形式（PNG）で返してきたときも ENCODE_FAILED（形式の違う画像を送らない）", async () => {
    stubBrowser({ width: 3000, height: 3000, encodedSizes: [1000], blobType: "image/png" });
    const result = await prepareStoryImage(new File([""], "big.jpg", { type: "image/jpeg" }));
    expect(result).toEqual({ ok: false, error: { type: "ENCODE_FAILED" } });
  });
});

describe("storyImageErrorMessage", () => {
  it("読めない形式は、何を選べばよいかが分かる文言", () => {
    expect(storyImageErrorMessage({ type: "UNREADABLE" })).toBe(
      "この画像はブラウザで読めない形式です。JPEG か PNG の画像を選んでください"
    );
  });

  it("大きすぎるときは上限を MB で示す", () => {
    expect(storyImageErrorMessage({ type: "TOO_LARGE", maxBytes: MAX })).toContain("4 MB");
  });

  it("書き直せないときは別の画像かブラウザを促す", () => {
    expect(storyImageErrorMessage({ type: "ENCODE_FAILED" })).toContain("別の画像");
  });
});
