import { type Result, err, ok } from "@physifun/domain";

/**
 * ストーリーの画像をアップロード API（`POST /api/my/projects/[projectId]/story-images`、#319）に送る（#320）。
 * 成功すると本文（`image` の `src`）に入れる URL が返る。失敗の文言は API のものをそのまま使い
 * （「JPEG / PNG / WebP の画像を選んでください」など）、読めない応答のときは共通の文言にする
 */

/** 失敗したときに利用者に見せる文言 */
export interface UploadStoryImageFailure {
  readonly message: string;
}

export const UPLOAD_STORY_IMAGE_FAILED_MESSAGE =
  "画像のアップロードに失敗しました。もう一度お試しください";

/** multipart/form-data のフィールド名（API の Route Handler と同じ） */
const FILE_FIELD = "file";

export async function uploadStoryImage(
  projectId: string,
  image: Blob
): Promise<Result<{ url: string }, UploadStoryImageFailure>> {
  const formData = new FormData();
  formData.append(FILE_FIELD, image);

  let response: Response;
  try {
    response = await fetch(`/api/my/projects/${encodeURIComponent(projectId)}/story-images`, {
      method: "POST",
      body: formData,
    });
  } catch {
    return err({ message: UPLOAD_STORY_IMAGE_FAILED_MESSAGE });
  }

  // 応答が JSON でないこともある（ホスティングが 413 で止めたときなど）
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = readString(json, ["error", "message"]);
    return err({ message: message || UPLOAD_STORY_IMAGE_FAILED_MESSAGE });
  }
  const url = readString(json, ["data", "url"]);
  if (!url) return err({ message: UPLOAD_STORY_IMAGE_FAILED_MESSAGE });
  return ok({ url });
}

/**
 * JSON の決まった場所の文字を読む。無ければ空文字
 */
function readString(json: unknown, path: readonly string[]): string {
  let current: unknown = json;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return "";
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : "";
}
