/**
 * CreateReturnUseCase
 * リターンを作成するユースケース
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
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { ReturnId } from "@/domain/project/value-objects/ReturnId";
import { Return } from "@/domain/project/entities/Return";

/**
 * リターン作成入力データ
 */
export interface CreateReturnInput {
  projectId: string;
  hostId: string;
  name: string;
  description: string;
  estimatedDeliveryDate?: Date | null;
  quantityLimit?: number | null;
}

/**
 * リターン作成出力データ
 */
export interface CreateReturnOutput {
  id: string;
  projectId: string;
  name: string;
  description: string;
  estimatedDeliveryDate: Date | null;
  quantityLimit: number | null;
  order: number;
  createdAt: Date;
}

export class CreateReturnUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly returnRepository: ReturnRepository
  ) {}

  /**
   * リターンを作成
   * @param input 作成入力データ
   * @returns 作成結果
   */
  async execute(input: CreateReturnInput): Promise<Result<CreateReturnOutput, AppError>> {
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
        return err(forbiddenError("このプロジェクトにリターンを追加する権限がありません"));
      }

      // 4. 現在のリターン数を取得（順序用）
      const currentCount = await this.returnRepository.countByProjectId(projectIdResult.data);

      // 5. リターンIDの生成
      const returnId = ReturnId.generate();

      // 6. リターンエンティティの作成
      const returnResult = Return.create({
        id: returnId,
        projectId: projectIdResult.data,
        name: input.name,
        description: input.description,
        estimatedDeliveryDate: input.estimatedDeliveryDate,
        quantityLimit: input.quantityLimit,
        order: currentCount, // 最後に追加
      });

      if (!returnResult.success) {
        return err(returnResult.error);
      }

      // 7. リポジトリに保存
      const savedReturn = await this.returnRepository.create(returnResult.data);

      // 8. 出力DTOに変換して返却
      return ok({
        id: savedReturn.id.value,
        projectId: savedReturn.projectId.value,
        name: savedReturn.name,
        description: savedReturn.description,
        estimatedDeliveryDate: savedReturn.estimatedDeliveryDate,
        quantityLimit: savedReturn.quantityLimit,
        order: savedReturn.order,
        createdAt: savedReturn.createdAt,
      });
    } catch (error) {
      console.error("Failed to create return:", error);
      return err(internalError("リターンの作成に失敗しました"));
    }
  }
}
