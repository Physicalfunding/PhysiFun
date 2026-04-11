/**
 * ReorderProjectImagesUseCase
 * プロジェクト画像の順序を変更するユースケース
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

/**
 * 並び替え入力データ
 */
export interface ReorderProjectImagesInput {
  projectId: string;
  hostId: string;
  newOrder: number[]; // 新しい順序のインデックス配列
}

/**
 * 並び替え出力データ
 */
export interface ReorderProjectImagesOutput {
  imageUrls: string[];
}

export class ReorderProjectImagesUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  /**
   * プロジェクト画像の順序を変更
   * @param input 並び替え入力データ
   * @returns 並び替え結果
   */
  async execute(
    input: ReorderProjectImagesInput
  ): Promise<Result<ReorderProjectImagesOutput, AppError>> {
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
        return err(forbiddenError("このプロジェクトの画像を並び替える権限がありません"));
      }

      // 4. 順序配列のバリデーション
      const imageCount = project.imageUrls.length;

      // 長さチェック
      if (input.newOrder.length !== imageCount) {
        return err(
          validationError(
            `順序配列の長さが画像数と一致しません（画像数: ${imageCount}、配列長: ${input.newOrder.length}）`
          )
        );
      }

      // 各インデックスの有効性チェック
      const validIndices = new Set<number>();
      for (const index of input.newOrder) {
        if (index < 0 || index >= imageCount) {
          return err(validationError(`無効なインデックスが含まれています: ${index}`));
        }
        if (validIndices.has(index)) {
          return err(validationError(`重複したインデックスが含まれています: ${index}`));
        }
        validIndices.add(index);
      }

      // 5. 新しい順序で画像URLを並び替え
      const currentUrls = project.imageUrls;
      const newImageUrls = input.newOrder.map((index) => currentUrls[index]);

      // 6. プロジェクトを更新
      const updatedProject = project.updateImages(newImageUrls);
      await this.projectRepository.update(updatedProject);

      // 7. 結果を返却
      return ok({
        imageUrls: newImageUrls,
      });
    } catch (error) {
      console.error("Failed to reorder project images:", error);
      return err(internalError("画像の並び替えに失敗しました"));
    }
  }
}
