/**
 * ReorderReturnsUseCase
 * リターンの順序を変更するユースケース
 */
import { Result, AppError, ok, err, notFoundError, forbiddenError, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { ReturnRepository } from "@/domain/project/repositories/ReturnRepository";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { ReturnId } from "@/domain/project/value-objects/ReturnId";

/**
 * リターン順序変更入力データ
 */
export interface ReorderReturnsInput {
  projectId: string;
  hostId: string;
  orderedReturnIds: string[];
}

/**
 * リターン順序変更出力データ
 */
export interface ReorderReturnsOutput {
  reordered: boolean;
}

export class ReorderReturnsUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly returnRepository: ReturnRepository
  ) {}

  /**
   * リターンの順序を変更
   * @param input 順序変更入力データ
   * @returns 変更結果
   */
  async execute(input: ReorderReturnsInput): Promise<Result<ReorderReturnsOutput, AppError>> {
    try {
      // 1. プロジェクトIDのバリデーション
      const projectIdResult = ProjectId.create(input.projectId);
      if (!projectIdResult.success) {
        return err(projectIdResult.error);
      }

      // 2. リターンIDsのバリデーション
      const returnIds: ReturnId[] = [];
      for (const idStr of input.orderedReturnIds) {
        const returnIdResult = ReturnId.create(idStr);
        if (!returnIdResult.success) {
          return err(returnIdResult.error);
        }
        returnIds.push(returnIdResult.data);
      }

      // 3. プロジェクトの取得
      const project = await this.projectRepository.findById(projectIdResult.data);
      if (!project) {
        return err(notFoundError("プロジェクトが見つかりません"));
      }

      // 4. オーナーチェック
      if (project.hostId.value !== input.hostId) {
        return err(forbiddenError("リターンの順序を変更する権限がありません"));
      }

      // 5. 順序の更新
      await this.returnRepository.updateOrder(projectIdResult.data, returnIds);

      return ok({
        reordered: true,
      });
    } catch (error) {
      console.error("Failed to reorder returns:", error);
      return err(internalError("リターンの順序変更に失敗しました"));
    }
  }
}
