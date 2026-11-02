import type { ProjectOwnerPort } from "../../recruitment/ports/ProjectOwnerPort";
import type { ImageStoragePort } from "../../shared/ImageStoragePort";

/**
 * UploadStoryImageUseCase のポートインターフェース
 *
 * 所有者チェック（`ProjectOwnerPort`）と画像の置き場所（`ImageStoragePort`）を合わせたもの。
 * インフラ層で実装する。
 */
export type UploadStoryImagePort = ProjectOwnerPort & ImageStoragePort;
