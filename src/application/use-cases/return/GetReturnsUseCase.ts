/**
 * GetReturnsUseCase
 * リターン一覧を取得するユースケース
 */
import { Result, AppError, ok, err, internalError } from "@/domain/shared/result";
import { ReturnRepository } from "@/domain/project/repositories/ReturnRepository";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";

/**
 * リターン一覧取得入力データ
 */
export interface GetReturnsInput {
  projectId: string;
}

/**
 * リターン出力データ
 */
export interface ReturnOutput {
  id: string;
  projectId: string;
  name: string;
  description: string;
  estimatedDeliveryDate: Date | null;
  quantityLimit: number | null;
  order: number;
  createdAt: Date;
}

/**
 * リターン一覧取得出力データ
 */
export interface GetReturnsOutput {
  returns: ReturnOutput[];
}

export class GetReturnsUseCase {
  constructor(
    private readonly returnRepository: ReturnRepository
  ) {}

  /**
   * リターン一覧を取得
   * @param input 取得入力データ
   * @returns 取得結果
   */
  async execute(input: GetReturnsInput): Promise<Result<GetReturnsOutput, AppError>> {
    try {
      // 1. プロジェクトIDのバリデーション
      const projectIdResult = ProjectId.create(input.projectId);
      if (!projectIdResult.success) {
        return err(projectIdResult.error);
      }

      // 2. リターン一覧の取得
      const returns = await this.returnRepository.findByProjectId(projectIdResult.data);

      // 3. 出力DTOに変換して返却
      return ok({
        returns: returns.map((r) => ({
          id: r.id.value,
          projectId: r.projectId.value,
          name: r.name,
          description: r.description,
          estimatedDeliveryDate: r.estimatedDeliveryDate,
          quantityLimit: r.quantityLimit,
          order: r.order,
          createdAt: r.createdAt,
        })),
      });
    } catch (error) {
      console.error("Failed to get returns:", error);
      return err(internalError("リターン一覧の取得に失敗しました"));
    }
  }
}
