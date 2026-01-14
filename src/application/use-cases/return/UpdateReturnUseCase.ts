/**
 * UpdateReturnUseCase
 * リターンを更新するユースケース
 */
import { Result, AppError, ok, err, notFoundError, forbiddenError, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { ReturnRepository } from "@/domain/project/repositories/ReturnRepository";
import { ReturnId } from "@/domain/project/value-objects/ReturnId";
import { Return } from "@/domain/project/entities/Return";

/**
 * リターン更新入力データ
 */
export interface UpdateReturnInput {
  returnId: string;
  hostId: string;
  name?: string;
  description?: string;
  estimatedDeliveryDate?: Date | null;
  quantityLimit?: number | null;
}

/**
 * リターン更新出力データ
 */
export interface UpdateReturnOutput {
  id: string;
  projectId: string;
  name: string;
  description: string;
  estimatedDeliveryDate: Date | null;
  quantityLimit: number | null;
  order: number;
  createdAt: Date;
}

export class UpdateReturnUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly returnRepository: ReturnRepository
  ) {}

  /**
   * リターンを更新
   * @param input 更新入力データ
   * @returns 更新結果
   */
  async execute(input: UpdateReturnInput): Promise<Result<UpdateReturnOutput, AppError>> {
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
        return err(forbiddenError("このリターンを更新する権限がありません"));
      }

      // 5. 更新データの準備（指定されたフィールドのみ更新）
      const updateData: {
        name?: string;
        description?: string;
        estimatedDeliveryDate?: Date | null;
        quantityLimit?: number | null;
      } = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.description !== undefined) {
        updateData.description = input.description;
      }
      if (input.estimatedDeliveryDate !== undefined) {
        updateData.estimatedDeliveryDate = input.estimatedDeliveryDate;
      }
      if (input.quantityLimit !== undefined) {
        updateData.quantityLimit = input.quantityLimit;
      }

      // 6. リターンの更新
      const updateResult = existingReturn.update(updateData);
      if (!updateResult.success) {
        return err(updateResult.error);
      }

      // 7. リポジトリに保存
      const updatedReturn = await this.returnRepository.update(updateResult.data);

      // 8. 出力DTOに変換して返却
      return ok({
        id: updatedReturn.id.value,
        projectId: updatedReturn.projectId.value,
        name: updatedReturn.name,
        description: updatedReturn.description,
        estimatedDeliveryDate: updatedReturn.estimatedDeliveryDate,
        quantityLimit: updatedReturn.quantityLimit,
        order: updatedReturn.order,
        createdAt: updatedReturn.createdAt,
      });
    } catch (error) {
      console.error("Failed to update return:", error);
      return err(internalError("リターンの更新に失敗しました"));
    }
  }
}
