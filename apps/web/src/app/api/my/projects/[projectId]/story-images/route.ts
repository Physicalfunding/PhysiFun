import type { NextRequest } from "next/server";
import {
  UploadStoryImageUseCase,
  STORY_IMAGE_MAX_BYTES,
  type UploadStoryImageError,
} from "@physifun/application";
import { getUploadStoryImagePort, isAllowedImageUrl } from "@/lib/di/story-image";
import { getCurrentUserId } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  validationErrorResponse,
  payloadTooLargeResponse,
  internalErrorResponse,
} from "@physifun/server-shared";

/** multipart/form-data のフィールド名 */
const FILE_FIELD = "file";

const MAX_MB = STORY_IMAGE_MAX_BYTES / (1024 * 1024);

/**
 * UseCase のエラー型に応じた HTTP レスポンスを返す
 */
function handleError(error: UploadStoryImageError) {
  switch (error.type) {
    case "INVALID_ACCOUNT_ID":
      return validationErrorResponse("無効なアカウントIDです");
    case "INVALID_PROJECT_ID":
      return validationErrorResponse("無効なプロジェクトIDです");
    case "PROJECT_NOT_FOUND":
      return notFoundResponse("プロジェクト");
    case "NOT_OWNER":
      return forbiddenResponse("このプロジェクトの編集権限がありません");
    case "UNSUPPORTED_IMAGE_FORMAT":
      return validationErrorResponse("JPEG / PNG / WebP の画像を選んでください", {
        [FILE_FIELD]: ["JPEG / PNG / WebP の画像ではありません"],
      });
    case "IMAGE_TOO_LARGE":
      return payloadTooLargeResponse(`画像は 1 枚 ${MAX_MB} MB までです`);
    case "IMAGE_URL_NOT_ALLOWED":
      // 置き場所の設定の誤り。利用者には直せないのでサーバーエラーにする
      console.error("[api/my/projects/[projectId]/story-images] URL not allowed:", error.url);
      return internalErrorResponse();
  }
}

/**
 * POST /api/my/projects/[projectId]/story-images
 * ストーリーに入れる画像をアップロードする（multipart/form-data の `file`）。
 * 成功すると `{ url }` を返す。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // レート制限: 20 req / min / user
    const limited = await enforceRateLimit("uploadStoryImage", userId);
    if (limited) return limited;

    const { projectId } = await params;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return validationErrorResponse("multipart/form-data で画像を送ってください");
    }
    const file = formData.get(FILE_FIELD);
    if (!(file instanceof Blob)) {
      return validationErrorResponse("画像を選んでください", {
        [FILE_FIELD]: ["画像が送られていません"],
      });
    }

    // 大きすぎるものは、バイト列に写す前にここで断る（`formData()` の時点でリクエスト全体は読み終えているので、
    // 受信量を減らす効果は無い。受信量の実質の上限は Vercel の 4.5 MB）。上限の正は UseCase 側の
    // `STORY_IMAGE_MAX_BYTES` で、実際のバイト数の検査もそちらで行う
    if (file.size > STORY_IMAGE_MAX_BYTES) {
      return payloadTooLargeResponse(`画像は 1 枚 ${MAX_MB} MB までです`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());

    const useCase = new UploadStoryImageUseCase(getUploadStoryImagePort(), isAllowedImageUrl);
    const result = await useCase.execute({ accountId: userId, projectId, bytes });

    if (!result.ok) {
      return handleError(result.error);
    }

    // バケット内のパスはクライアントが使わないので返さない（置き場所の構造を見せない）
    return successResponse({ url: result.value.url }, 201);
  } catch (error) {
    console.error("[api/my/projects/[projectId]/story-images] POST error:", error);
    return internalErrorResponse();
  }
}
