import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AccountId, ProjectId } from "@physifun/domain";
import { STORY_IMAGE_MAX_BYTES } from "@physifun/application";

/**
 * POST /api/my/projects/[projectId]/story-images の HTTP への変換のテスト（#319）
 *
 * - セッション・回数制限・DI をモックし、UseCase の結果が HTTP のステータスになることを確かめる
 * - UseCase 自体の検査（形式・大きさ・所有者）は `UploadStoryImageUseCase.test.ts` で見る
 */

const OWNER_ID = "00000000-0000-4000-a000-000000000001";
const OTHER_ID = "00000000-0000-4000-a000-000000000002";
const PROJECT_ID = "00000000-0000-4000-b000-000000000001";
const PUBLIC_URL_BASE = "https://abc.supabase.co/storage/v1/object/public/project-images";

const getCurrentUserId = vi.fn<() => Promise<string | null>>();
const enforceRateLimit = vi.fn<() => Promise<Response | null>>();
const uploaded: { path: string; contentType: string }[] = [];

vi.mock("@/lib/session", () => ({ getCurrentUserId: () => getCurrentUserId() }));
vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimit(...(args as [])),
}));
// `@/lib/di/story-image` を import すると infrastructure（pg / Kysely）の読み込みが走るので、インメモリに差し替える
vi.mock("@/lib/di/story-image", async () => {
  const { AccountId } = await import("@physifun/domain");
  return {
    isAllowedImageUrl: (url: string) => url.startsWith("https://abc.supabase.co/"),
    getUploadStoryImagePort: () => ({
      async findProjectOwner(id: ProjectId): Promise<AccountId | null> {
        if (id.toString() !== PROJECT_ID) return null;
        const r = AccountId.from(OWNER_ID);
        return r.ok ? r.value : null;
      },
      async upload(params: { path: string; contentType: string }) {
        uploaded.push(params);
        return { publicUrl: `${PUBLIC_URL_BASE}/${params.path}` };
      },
      getPublicUrl: (path: string) => `${PUBLIC_URL_BASE}/${path}`,
    }),
  };
});

import { POST } from "../route";

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const pngBytes = (size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_HEAD);
  return bytes;
};

function postRequest(body: BodyInit | null, headers?: HeadersInit) {
  return new Request(`http://localhost/api/my/projects/${PROJECT_ID}/story-images`, {
    method: "POST",
    body,
    headers,
  });
}

function formWith(file: Blob | string, name = "photo.png") {
  const form = new FormData();
  if (typeof file === "string") form.append("file", file);
  else form.append("file", file, name);
  return form;
}

const params = { params: Promise.resolve({ projectId: PROJECT_ID }) };
const call = (request: Request) => POST(request as never, params);

describe("POST /api/my/projects/[projectId]/story-images", () => {
  beforeEach(() => {
    uploaded.length = 0;
    getCurrentUserId.mockReset().mockResolvedValue(OWNER_ID);
    enforceRateLimit.mockReset().mockResolvedValue(null);
  });

  it("リーダーが PNG を上げると 201 で URL が返る", async () => {
    const response = await call(
      postRequest(formWith(new Blob([pngBytes()], { type: "image/png" })))
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(uploaded).toHaveLength(1);
    expect(body.data).toEqual({ url: `${PUBLIC_URL_BASE}/${uploaded[0].path}` });
    expect(uploaded[0].path).toMatch(new RegExp(`^projects/${PROJECT_ID}/story/.+\\.png$`));
  });

  it("ログインしていないと 401", async () => {
    getCurrentUserId.mockResolvedValue(null);

    const response = await call(postRequest(formWith(new Blob([pngBytes()]))));

    expect(response.status).toBe(401);
    expect(enforceRateLimit).not.toHaveBeenCalled();
    expect(uploaded).toHaveLength(0);
  });

  it("回数制限に当たると、その 429 レスポンスをそのまま返す", async () => {
    enforceRateLimit.mockResolvedValue(new Response(null, { status: 429 }));

    const response = await call(postRequest(formWith(new Blob([pngBytes()]))));

    expect(response.status).toBe(429);
    expect(enforceRateLimit).toHaveBeenCalledWith("uploadStoryImage", OWNER_ID);
    expect(uploaded).toHaveLength(0);
  });

  it("他人のプロジェクトだと 403", async () => {
    getCurrentUserId.mockResolvedValue(OTHER_ID);

    const response = await call(postRequest(formWith(new Blob([pngBytes()]))));

    expect(response.status).toBe(403);
    expect(uploaded).toHaveLength(0);
  });

  it("中身が画像でないと 400（拡張子が .png でも）", async () => {
    const response = await call(
      postRequest(formWith(new Blob(["<svg></svg>"], { type: "image/png" }), "fake.png"))
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.fields.file).toBeDefined();
    expect(uploaded).toHaveLength(0);
  });

  it("4 MB を超えると 413", async () => {
    const response = await call(
      postRequest(formWith(new Blob([pngBytes(STORY_IMAGE_MAX_BYTES + 1)])))
    );

    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(uploaded).toHaveLength(0);
  });

  it("file が無い・ファイルでないと 400", async () => {
    expect((await call(postRequest(new FormData()))).status).toBe(400);
    expect((await call(postRequest(formWith("not a file")))).status).toBe(400);
    expect(uploaded).toHaveLength(0);
  });

  it("multipart/form-data でないと 400", async () => {
    const response = await call(
      postRequest(JSON.stringify({ file: "x" }), { "content-type": "application/json" })
    );

    expect(response.status).toBe(400);
  });
});
