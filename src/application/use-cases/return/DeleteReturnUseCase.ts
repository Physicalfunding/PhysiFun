/**
 * DeleteReturnUseCase
 * リターンを削除するユースケース
 */
import {
  Result,
  AppError,
  ok,
  err,
  notFoundError,
  forbiddenError,
  internalError,
} from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { ReturnRepository } from "@/domain/project/repositories/ReturnRepository";
import { ReturnId } from "@/domain/project/value-objects/ReturnId";

/**
 * リターン削除入力データ
 */
export interface DeleteReturnInput {
  returnId: string;
  hostId: string;
}

/**
 * リターン削除出力データ
 */
export interface DeleteReturnOutput {
  deleted: boolean;
}

export class DeleteReturnUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly returnRepository: ReturnRepository
  ) {}

  /**
   * リターンを削除
   * @param input 削除入力データ
   * @returns 削除結果
   */
  async execute(input: DeleteReturnInput): Promise<Result<DeleteReturnOutput, AppError>> {
    try {
      // 1. リターンIDのバリデーション
      const returnIdResult = ReturnId.create(input.returnId);
      if (!returnIdResult.success) {
        return err(returnIdResult.error);
      }

      // 2. リターンの取得
      const existingReturn = await this.returnRepository.findById(returnIdResult.data);
      if (!existingReturn) {
        return err(notFoundError("リターンが見つかりません"));
      }

      // 3. プロジェクトの取得
      const project = await this.projectRepository.findById(existingReturn.projectId);
      if (!project) {
        return err(notFoundError("プロジェクトが見つかりません"));
      }

      // 4. オーナーチェック
      if (project.hostId.value !== input.hostId) {
        return err(forbiddenError("このリターンを削除する権限がありません"));
      }

      // 5. リターンの削除
      await this.returnRepository.delete(returnIdResult.data);

      return ok({
        deleted: true,
      });
    } catch (error) {
      console.error("Failed to delete return:", error);
      return err(internalError("リターンの削除に失敗しました"));
    }
  }
}
