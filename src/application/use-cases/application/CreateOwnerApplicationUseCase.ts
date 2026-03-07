import { OwnerApplication } from "@/domain/application/entities/OwnerApplication";
import { OwnerApplicationRepository } from "@/domain/application/repositories/OwnerApplicationRepository";
import { ApplicationId } from "@/domain/application/value-objects/ApplicationId";
import { type Result, type AppError, ok } from "@/domain/shared/result";

/**
 * オーナー応募作成ユースケースの入力データ
 */
export interface CreateOwnerApplicationInput {
  name: string;
  email: string;
  projectTitle: string;
  projectSummary: string;
  projectStory: string;
}

/**
 * CreateOwnerApplicationUseCase
 * 新規オーナー応募を処理するユースケース
 *
 * 責務:
 * - 応募データのバリデーション（エンティティで実施）
 * - 応募の永続化
 */
export class CreateOwnerApplicationUseCase {
  constructor(
    private readonly ownerApplicationRepository: OwnerApplicationRepository
  ) {}

  /**
   * オーナー応募を作成
   * @param input 応募情報
   * @returns 作成された応募、またはエラー
   */
  async execute(
    input: CreateOwnerApplicationInput
  ): Promise<Result<OwnerApplication, AppError>> {
    // 1. エンティティの作成（バリデーション含む）
    const applicationResult = OwnerApplication.create({
      id: ApplicationId.generate(),
      name: input.name,
      email: input.email,
      projectTitle: input.projectTitle,
      projectSummary: input.projectSummary,
      projectStory: input.projectStory,
    });

    if (!applicationResult.success) {
      return applicationResult;
    }

    // 2. 応募の永続化
    const createdApplication = await this.ownerApplicationRepository.create(
      applicationResult.data
    );

    return ok(createdApplication);
  }
}
