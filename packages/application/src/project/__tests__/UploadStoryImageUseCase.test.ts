import { describe, it, expect, beforeEach } from "vitest";
import { AccountId, type ProjectId } from "@physifun/domain";
import { UploadStoryImageUseCase } from "../UploadStoryImageUseCase";
import type { UploadStoryImagePort } from "../ports/UploadStoryImagePort";
import { STORY_IMAGE_MAX_BYTES } from "../storyImage";

// ==================== テストヘルパー ====================

const OWNER_ACCOUNT_ID = "00000000-0000-4000-a000-000000000001";
const OTHER_ACCOUNT_ID = "00000000-0000-4000-a000-000000000002";
const PROJECT_ID = "00000000-0000-4000-b000-000000000001";
const MISSING_PROJECT_ID = "00000000-0000-4000-b000-0000000000ff";

const PUBLIC_URL_BASE = "https://abc.supabase.co/storage/v1/object/public/project-images";

/** 先頭バイトが形式どおりの小さな画像データ */
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_HEAD = [0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const image = (head: number[], size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set(head);
  return bytes;
};

/**
 * インメモリ Port。アップロードは呼び出しを記録するだけ
 */
class InMemoryUploadStoryImagePort implements UploadStoryImagePort {
  /** プロジェクト ID → 所有者のアカウント ID */
  owners = new Map<string, string>([[PROJECT_ID, OWNER_ACCOUNT_ID]]);
  uploaded: { path: string; bytes: Uint8Array; contentType: string }[] = [];
  /** 公開 URL のホスト部分（置き場所の設定ミスの再現用に差し替える） */
  publicUrlBase = PUBLIC_URL_BASE;

  async findProjectOwner(id: ProjectId): Promise<AccountId | null> {
    const owner = this.owners.get(id.toString());
    if (!owner) return null;
    const r = AccountId.from(owner);
    if (!r.ok) throw new Error("fixture broken");
    return r.value;
  }

  async upload(params: { path: string; bytes: Uint8Array; contentType: string }) {
    this.uploaded.push(params);
    return { publicUrl: this.getPublicUrl(params.path) };
  }

  getPublicUrl(path: string): string {
    return `${this.publicUrlBase}/${path}`;
  }
}

// ==================== テスト ====================

describe("UploadStoryImageUseCase", () => {
  let port: InMemoryUploadStoryImagePort;
  let useCase: UploadStoryImageUseCase;

  beforeEach(() => {
    port = new InMemoryUploadStoryImagePort();
    useCase = new UploadStoryImageUseCase(port, (url) =>
      url.startsWith("https://abc.supabase.co/")
    );
  });

  // ---- ハッピーパス ----

  it.each([
    ["JPEG", JPEG_HEAD, "image/jpeg", "jpg"],
    ["PNG", PNG_HEAD, "image/png", "png"],
    ["WebP", WEBP_HEAD, "image/webp", "webp"],
  ])(
    "所有者が %s を上げると、プロジェクトのフォルダに保存されて URL が返る",
    async (_, head, mime, ext) => {
      const bytes = image(head);

      const result = await useCase.execute({
        accountId: OWNER_ACCOUNT_ID,
        projectId: PROJECT_ID,
        bytes,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(port.uploaded).toHaveLength(1);
      const [upload] = port.uploaded;
      expect(upload.path).toMatch(
        new RegExp(`^projects/${PROJECT_ID}/story/[0-9a-f-]{36}\\.${ext}$`)
      );
      expect(upload.contentType).toBe(mime);
      expect(upload.bytes).toBe(bytes);
      expect(result.value.path).toBe(upload.path);
      expect(result.value.url).toBe(`${PUBLIC_URL_BASE}/${upload.path}`);
    }
  );

  it("ちょうど上限の大きさは受け付ける", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      projectId: PROJECT_ID,
      bytes: image(PNG_HEAD, STORY_IMAGE_MAX_BYTES),
    });

    expect(result.ok).toBe(true);
    expect(port.uploaded).toHaveLength(1);
  });

  it("2 回上げると別のファイル名になる", async () => {
    const input = { accountId: OWNER_ACCOUNT_ID, projectId: PROJECT_ID, bytes: image(PNG_HEAD) };
    await useCase.execute(input);
    await useCase.execute(input);

    expect(port.uploaded).toHaveLength(2);
    expect(port.uploaded[0].path).not.toBe(port.uploaded[1].path);
  });

  // ---- エラーケース ----

  it("不正な accountId 形式で INVALID_ACCOUNT_ID", async () => {
    const result = await useCase.execute({
      accountId: "not-a-uuid",
      projectId: PROJECT_ID,
      bytes: image(PNG_HEAD),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_ACCOUNT_ID");
    expect(port.uploaded).toHaveLength(0);
  });

  it("不正な projectId 形式で INVALID_PROJECT_ID", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      projectId: "x",
      bytes: image(PNG_HEAD),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_PROJECT_ID");
    expect(port.uploaded).toHaveLength(0);
  });

  it("プロジェクトが存在しないと PROJECT_NOT_FOUND", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      projectId: MISSING_PROJECT_ID,
      bytes: image(PNG_HEAD),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("PROJECT_NOT_FOUND");
    expect(port.uploaded).toHaveLength(0);
  });

  it("他人のプロジェクトには上げられない（NOT_OWNER）", async () => {
    const result = await useCase.execute({
      accountId: OTHER_ACCOUNT_ID,
      projectId: PROJECT_ID,
      bytes: image(PNG_HEAD),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("NOT_OWNER");
    expect(port.uploaded).toHaveLength(0);
  });

  it.each([
    ["GIF", image([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
    [
      "中身が文字（拡張子だけ画像に変えたものを想定）",
      new TextEncoder().encode("<html>not an image</html>"),
    ],
    ["空のファイル", new Uint8Array([])],
  ])("%sは UNSUPPORTED_IMAGE_FORMAT", async (_, bytes) => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      projectId: PROJECT_ID,
      bytes,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNSUPPORTED_IMAGE_FORMAT");
    expect(port.uploaded).toHaveLength(0);
  });

  it("上限を 1 バイトでも超えると IMAGE_TOO_LARGE", async () => {
    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      projectId: PROJECT_ID,
      bytes: image(JPEG_HEAD, STORY_IMAGE_MAX_BYTES + 1),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      type: "IMAGE_TOO_LARGE",
      maxBytes: STORY_IMAGE_MAX_BYTES,
      actualBytes: STORY_IMAGE_MAX_BYTES + 1,
    });
    expect(port.uploaded).toHaveLength(0);
  });

  it("置き場所が許可リスト外の URL を返すと IMAGE_URL_NOT_ALLOWED（設定ミスの早期検出）", async () => {
    port.publicUrlBase = "https://evil.example.com/project-images";

    const result = await useCase.execute({
      accountId: OWNER_ACCOUNT_ID,
      projectId: PROJECT_ID,
      bytes: image(PNG_HEAD),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("IMAGE_URL_NOT_ALLOWED");
  });
});
