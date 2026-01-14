/**
 * DeleteProjectImageUseCase
 * プロジェクト画像を削除するユースケース
 */
import { Result, AppError, ok, err, validationError, notFoundError, forbiddenError, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { ImageUploadService } from "@/infrastructure/storage/ImageUploadService";

/**
 * 削除入力データ
 */
export interface DeleteProjectImageInput {
  projectId: string;
  hostId: string;
  imageIndex: number;
}

/**
 * 削除出力データ
 */
export interface DeleteProjectImageOutput {
  imageUrls: string[];
}

export class DeleteProjectImageUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly imageUploadService: ImageUploadService
  ) {}

  /**
   * プロジェクト画像を削除
   * @param input 削除入力データ
   * @returns 削除結果
   */
  async execute(input: DeleteProjectImageInput): Promise<Result<DeleteProjectImageOutput, AppError>> {
    try {
      // 1. プロジェクトIDのバリデーション
      const projectIdResult = ProjectId.create(input.projectId);
      if (!projectIdResult.success) {
        return err(projectIdResult.error);
      }

      // 2. プロジェクトの取得
      const project = await this.projectRepository.findById(projectIdResult.data);
      if (!project) {
        return err(notFoundError("プロジェクトが見つかりません"));
      }

      // 3. オーナーチェック
      if (project.hostId.value !== input.hostId) {
        return err(forbiddenError("このプロジェクトの画像を削除する権限がありません"));
      }

      // 4. 画像の存在チェック
      if (project.imageUrls.length === 0) {
        return err(validationError("削除する画像がありません"));
      }

      // 5. インデックスの有効性チェック
      if (input.imageIndex < 0 || input.imageIndex >= project.imageUrls.length) {
        return err(validationError("無効な画像インデックスです"));
      }

      // 6. 削除対象のURLを取得
      const deletedUrl = project.imageUrls[input.imageIndex];

      // 7. 画像URLの配列から削除
      const newImageUrls = [
        ...project.imageUrls.slice(0, input.imageIndex),
        ...project.imageUrls.slice(input.imageIndex + 1),
      ];

      // 8. プロジェクトを更新
      const updatedProject = project.updateImages(newImageUrls);
      await this.projectRepository.update(updatedProject);

      // 9. ストレージから画像を削除（非同期で実行、エラーは無視）
      // URLからパスを抽出する（バケットによって異なる場合があるため、ここでは簡易的に処理）
      try {
        // URLからパスを抽出（/projects/で始まる部分）
        const urlParts = deletedUrl.split("/");
        const projectsIndex = urlParts.findIndex((part) => part === "projects");
        if (projectsIndex !== -1) {
          const path = urlParts.slice(projectsIndex).join("/");
          await this.imageUploadService.deleteImage(path);
        }
      } catch {
        // ストレージ削除の失敗は警告として記録するのみ
        console.warn("Failed to delete image from storage:", deletedUrl);
      }

      // 10. 結果を返却
      return ok({
        imageUrls: newImageUrls,
      });
    } catch (error) {
      console.error("Failed to delete project image:", error);
      return err(internalError("画像の削除に失敗しました"));
    }
  }
}
