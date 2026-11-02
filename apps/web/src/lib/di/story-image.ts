import {
  createIsAllowedStoryImageUrl,
  type IsAllowedStoryImageUrl,
  type UploadStoryImagePort,
} from "@physifun/application";
import { createImageStorage, findProjectOwner } from "@physifun/infrastructure";
import { isAllowedImageUrl } from "@physifun/ui-shared";

/**
 * ストーリーの画像（#319）の DI ヘルパー
 *
 * 画像の置き場所は環境変数で決まる（Supabase が設定されていればそこへ、無ければモック）。
 * 規約（#119）に従い、モジュールレベルで作らず都度生成する。
 */

/** UploadStoryImageUseCase 用のポート（所有者チェック + 画像の置き場所） */
export function getUploadStoryImagePort(): UploadStoryImagePort {
  const storage = createImageStorage();
  return {
    findProjectOwner,
    upload: (params) => storage.upload(params),
    getPublicUrl: (path) => storage.getPublicUrl(path),
  };
}

/**
 * 本文に入れてよい画像の URL か（UpdateProjectDraftUseCase 用）。
 * アップロード API が返す URL と同じ決まり（そのプロジェクトのストーリー用フォルダ配下 + `isAllowedImageUrl`）。
 */
export function getIsAllowedStoryImageUrl(): IsAllowedStoryImageUrl {
  return createIsAllowedStoryImageUrl(createImageStorage(), isAllowedImageUrl);
}

/** `@physifun/ui-shared` の画像 URL 許可リスト（UploadStoryImageUseCase に渡す） */
export { isAllowedImageUrl };
