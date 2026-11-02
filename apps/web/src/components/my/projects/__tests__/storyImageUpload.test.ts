import { afterEach, describe, expect, it, vi } from "vitest";
import { UPLOAD_STORY_IMAGE_FAILED_MESSAGE, uploadStoryImage } from "../storyImageUpload";

/**
 * Issue #320: アップロード API（#319）への送信と、応答の読み方
 */

const PROJECT_ID = "00000000-0000-4000-b000-000000000001";
const URL_RETURNED = "https://abc.supabase.co/storage/v1/object/public/project-images/x.jpg";

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("uploadStoryImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("そのプロジェクトの API に multipart/form-data の file で送り、返ってきた URL を返す", async () => {
    const fetchMock = stubFetch(json({ success: true, data: { url: URL_RETURNED } }, 201));
    const image = new Blob([new Uint8Array(8)], { type: "image/jpeg" });

    const result = await uploadStoryImage(PROJECT_ID, image);

    expect(result).toEqual({ ok: true, value: { url: URL_RETURNED } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/my/projects/${PROJECT_ID}/story-images`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const sent = (init.body as FormData).get("file");
    expect(sent).toBeInstanceOf(Blob);
    expect((sent as Blob).size).toBe(8);
  });

  it("API のエラー文言（形式・大きさ・回数制限など）をそのまま返す", async () => {
    stubFetch(
      json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "JPEG / PNG / WebP の画像を選んでください" },
        },
        400
      )
    );
    const result = await uploadStoryImage(PROJECT_ID, new Blob([""]));
    expect(result).toEqual({
      ok: false,
      error: { message: "JPEG / PNG / WebP の画像を選んでください" },
    });
  });

  it("応答が JSON でないとき（ホスティングの 413 など）は共通の文言にする", async () => {
    stubFetch(new Response("Request Entity Too Large", { status: 413 }));
    const result = await uploadStoryImage(PROJECT_ID, new Blob([""]));
    expect(result).toEqual({ ok: false, error: { message: UPLOAD_STORY_IMAGE_FAILED_MESSAGE } });
  });

  it("成功の応答に URL が無いときも共通の文言にする（本文に空の src を入れない）", async () => {
    stubFetch(json({ success: true, data: {} }, 201));
    const result = await uploadStoryImage(PROJECT_ID, new Blob([""]));
    expect(result).toEqual({ ok: false, error: { message: UPLOAD_STORY_IMAGE_FAILED_MESSAGE } });
  });

  it("通信そのものに失敗したときも共通の文言にする", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    const result = await uploadStoryImage(PROJECT_ID, new Blob([""]));
    expect(result).toEqual({ ok: false, error: { message: UPLOAD_STORY_IMAGE_FAILED_MESSAGE } });
  });

  it("プロジェクト ID は URL に入れる前にエスケープする", async () => {
    const fetchMock = stubFetch(json({ success: true, data: { url: URL_RETURNED } }, 201));
    await uploadStoryImage("a/b?c", new Blob([""]));
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("/api/my/projects/a%2Fb%3Fc/story-images");
  });
});
