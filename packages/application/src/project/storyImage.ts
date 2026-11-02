import type { ProjectId } from "@physifun/domain";
import type { ImageStoragePort } from "../shared/ImageStoragePort";

/**
 * ストーリーに入れる画像の決まり（設計書 §5.3・§5.7、#319）
 *
 * アップロード（`UploadStoryImageUseCase`）と、本文を保存するときの画像 URL の検査
 * （`UpdateProjectDraftUseCase`）の両方がここを使い、決まりを 1 か所にする。
 */

/** 1 枚の大きさの上限。Vercel の関数が受けられるリクエストは 4.5 MB までなので、少し余裕を残す */
export const STORY_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** 受け付ける形式と、保存するときの拡張子 */
export const STORY_IMAGE_FORMATS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type StoryImageMimeType = keyof typeof STORY_IMAGE_FORMATS;

const startsWithBytes = (bytes: Uint8Array, expected: readonly number[], offset = 0): boolean =>
  expected.every((b, i) => bytes[offset + i] === b);

/**
 * 画像の形式を、ファイル名ではなく中身の先頭（マジックナンバー）で判定する。
 * 受け付けない形式・画像でないものは null。
 */
export function detectStoryImageFormat(bytes: Uint8Array): StoryImageMimeType | null {
  // JPEG: FF D8 FF
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // PNG: 89 'P' 'N' 'G' 0D 0A 1A 0A
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP: 'R' 'I' 'F' 'F' <size:4> 'W' 'E' 'B' 'P'
  if (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

/** プロジェクトごとの置き場所（バケット内のフォルダ。末尾に `/` は付けない） */
export function storyImageFolder(projectId: ProjectId): string {
  return `projects/${projectId.toString()}/story`;
}

/**
 * 本文に入れてよい画像の URL か（そのプロジェクトのストーリー用フォルダに置いた画像だけ）
 */
export type IsAllowedStoryImageUrl = (url: string, projectId: ProjectId) => boolean;

/**
 * 画像の置き場所から `IsAllowedStoryImageUrl` を組み立てる。
 *
 * `*.supabase.co` を広く許すと、他人の Storage の画像で閲覧者を追跡できてしまうので、
 * 自分の Storage の、そのプロジェクトのフォルダ配下だけを許す。`isAllowedImageUrl`（`@physifun/ui-shared`。
 * 環境変数で結果が変わるので外から受け取る）も重ねて、表示側の許可リストと食い違わないようにする。
 */
export function createIsAllowedStoryImageUrl(
  storage: Pick<ImageStoragePort, "getPublicUrl">,
  isAllowedImageUrl: (url: string) => boolean
): IsAllowedStoryImageUrl {
  return (url, projectId) =>
    url.startsWith(`${storage.getPublicUrl(storyImageFolder(projectId))}/`) &&
    isAllowedImageUrl(url);
}
