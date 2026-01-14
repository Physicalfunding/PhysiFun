/**
 * UploadProjectImagesUseCase
 * プロジェクト画像をアップロードするユースケース
 */
import {
  Result,
  AppError,
  ok,
  err,
  validationError,
  notFoundError,
  forbiddenError,
  internalError,
} from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { ImageUploadService } from "@/infrastructure/storage/ImageUploadService";

/**
 * 画像ファイルの型定義
 */
export interface ImageFile {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
}

/**
 * アップロード入力データ
 */
export interface UploadProjectImagesInput {
  projectId: string;
  hostId: string;
  files: ImageFile[];
}

/**
 * アップロード出力データ
 */
export interface UploadProjectImagesOutput {
  imageUrls: string[];
}

/**
 * 定数
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export class UploadProjectImagesUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly imageUploadService: ImageUploadService
  ) {}

  /**
   * プロジェクト画像をアップロード
   * @param input アップロード入力データ
   * @returns アップロード結果
   */
  async execute(
    input: UploadProjectImagesInput
  ): Promise<Result<UploadProjectImagesOutput, AppError>> {
    try {
      // 1. ファイルの存在チェック
      if (input.files.length === 0) {
        return err(validationError("アップロードするファイルを選択してください"));
      }

      // 2. プロジェクトIDのバリデーション
      const projectIdResult = ProjectId.create(input.projectId);
      if (!projectIdResult.success) {
        return err(projectIdResult.error);
      }

      // 3. プロジェクトの取得
      const project = await this.projectRepository.findById(projectIdResult.data);
      if (!project) {
        return err(notFoundError("プロジェクトが見つかりません"));
      }

      // 4. オーナーチェック
      if (project.hostId.value !== input.hostId) {
        return err(forbiddenError("このプロジェクトの画像をアップロードする権限がありません"));
      }

      // 5. 画像数の上限チェック
      const totalImages = project.imageUrls.length + input.files.length;
      if (totalImages > MAX_IMAGES) {
        return err(
          validationError(
            `画像は最大${MAX_IMAGES}枚までアップロードできます（現在${project.imageUrls.length}枚）`
          )
        );
      }

      // 6. 各ファイルのバリデーション
      for (const file of input.files) {
        // ファイルサイズチェック
        if (file.size > MAX_FILE_SIZE) {
          return err(validationError(`ファイルサイズは5MB以下にしてください（${file.name}）`));
        }

        // ファイル形式チェック
        if (!ALLOWED_TYPES.includes(file.type)) {
          return err(
            validationError(
              `サポートされていないファイル形式です（${file.name}）。JPEG、PNG、WebP形式のみ対応しています`
            )
          );
        }
      }

      // 7. 画像のアップロード
      const uploadedUrls: string[] = [];
      const folder = `projects/${project.id.value}`;

      for (const file of input.files) {
        const uploadResult = await this.imageUploadService.uploadImage(
          {
            buffer: file.buffer,
            name: file.name,
            type: file.type,
          },
          folder
        );
        uploadedUrls.push(uploadResult.publicUrl);
      }

      // 8. プロジェクトの画像URLを更新
      const newImageUrls = [...project.imageUrls, ...uploadedUrls];
      const updatedProject = project.updateImages(newImageUrls);
      await this.projectRepository.update(updatedProject);

      // 9. 結果を返却
      return ok({
        imageUrls: newImageUrls,
      });
    } catch (error) {
      console.error("Failed to upload project images:", error);
      return err(internalError("画像のアップロードに失敗しました"));
    }
  }
}
