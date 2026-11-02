import { randomUUID } from "node:crypto";
import { type Result, err, ok, AccountId, ProjectId } from "@physifun/domain";
import type { UploadStoryImagePort } from "./ports/UploadStoryImagePort";
import {
  STORY_IMAGE_FORMATS,
  STORY_IMAGE_MAX_BYTES,
  createIsAllowedStoryImageUrl,
  detectStoryImageFormat,
  storyImageFolder,
} from "./storyImage";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface UploadStoryImageOutput {
  /** 本文（`image` の `src`）に入れる公開 URL */
  readonly url: string;
  /** バケット内のパス */
  readonly path: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type UploadStoryImageError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_PROJECT_ID" }
  | { readonly type: "PROJECT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" }
  /** 中身が JPEG / PNG / WebP でない（ファイル名や申告された Content-Type は見ない） */
  | { readonly type: "UNSUPPORTED_IMAGE_FORMAT" }
  | { readonly type: "IMAGE_TOO_LARGE"; readonly maxBytes: number; readonly actualBytes: number }
  /** 置き場所が返した URL が、本文に入れられる URL の決まりに合わない（環境設定の誤り） */
  | { readonly type: "IMAGE_URL_NOT_ALLOWED"; readonly url: string };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface UploadStoryImageInput {
  readonly accountId: string;
  readonly projectId: string;
  /** 画像の中身 */
  readonly bytes: Uint8Array;
}

// ==================== ユースケース ====================

/**
 * ストーリーに入れる画像をアップロードするユースケース（設計書 §6.5、#319）
 *
 * 処理フロー:
 * 1. AccountId / ProjectId VO 生成（入力バリデーション）
 * 2. プロジェクトの存在チェック + オーナー権限チェック
 * 3. 形式（中身で判定）と大きさの検査
 * 4. `projects/{projectId}/story/{uuid}.{ext}` に保存
 * 5. 返ってきた URL が本文に入れられる決まりに合うことを確かめる
 */
export class UploadStoryImageUseCase {
  constructor(
    private readonly port: UploadStoryImagePort,
    /** `@physifun/ui-shared` の `isAllowedImageUrl`（環境変数で結果が変わるので外から受け取る） */
    private readonly isAllowedImageUrl: (url: string) => boolean
  ) {}

  async execute(
    input: UploadStoryImageInput
  ): Promise<Result<UploadStoryImageOutput, UploadStoryImageError>> {
    // 1. AccountId / ProjectId VO 生成（入力バリデーション）
    const accountIdResult = AccountId.from(input.accountId);
    if (!accountIdResult.ok) {
      return err({ type: "INVALID_ACCOUNT_ID" });
    }

    const projectIdResult = ProjectId.from(input.projectId);
    if (!projectIdResult.ok) {
      return err({ type: "INVALID_PROJECT_ID" });
    }
    const projectId = projectIdResult.value;

    // 2. プロジェクトの存在チェック + オーナー権限チェック
    const ownerAccountId = await this.port.findProjectOwner(projectId);
    if (!ownerAccountId) {
      return err({ type: "PROJECT_NOT_FOUND" });
    }
    if (!ownerAccountId.equals(accountIdResult.value)) {
      return err({ type: "NOT_OWNER" });
    }

    // 3. 形式と大きさの検査
    const mimeType = detectStoryImageFormat(input.bytes);
    if (!mimeType) {
      return err({ type: "UNSUPPORTED_IMAGE_FORMAT" });
    }
    if (input.bytes.byteLength > STORY_IMAGE_MAX_BYTES) {
      return err({
        type: "IMAGE_TOO_LARGE",
        maxBytes: STORY_IMAGE_MAX_BYTES,
        actualBytes: input.bytes.byteLength,
      });
    }

    // 4. 保存（ファイル名は推測できないよう UUID にし、拡張子は判定した形式から決める）
    const path = `${storyImageFolder(projectId)}/${randomUUID()}.${STORY_IMAGE_FORMATS[mimeType]}`;
    const { publicUrl } = await this.port.upload({
      path,
      bytes: input.bytes,
      contentType: mimeType,
    });

    // 5. 返ってきた URL が、本文を保存するときの検査（UpdateProjectDraftUseCase）を通ることを確かめる
    const isAllowedStoryImageUrl = createIsAllowedStoryImageUrl(this.port, this.isAllowedImageUrl);
    if (!isAllowedStoryImageUrl(publicUrl, projectId)) {
      return err({ type: "IMAGE_URL_NOT_ALLOWED", url: publicUrl });
    }

    return ok({ url: publicUrl, path });
  }
}
