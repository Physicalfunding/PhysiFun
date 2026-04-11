/**
 * UnpublishProjectUseCase
 * プロジェクトを非公開（下書き）に戻すユースケース
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
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * プロジェクト非公開の入力データ
 */
export interface UnpublishProjectInput {
  /** プロジェクトID（UUID形式） */
  projectId: string;
  /** 操作を行うユーザーID（所有者確認用） */
  hostId: string;
}

/**
 * プロジェクト非公開の出力データ（DTO）
 */
export interface UnpublishProjectOutput {
  id: string;
  title: string;
  status: string;
}

export class UnpublishProjectUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  /**
   * プロジェクトを非公開（下書き）に戻す
   */
  async execute(input: UnpublishProjectInput): Promise<Result<UnpublishProjectOutput, AppError>> {
    try {
      // 1. プロジェクトIDのバリデーション
      const projectIdResult = ProjectId.create(input.projectId);
      if (!projectIdResult.success) {
        return err(projectIdResult.error);
      }

      // 2. ホストIDのバリデーション
      const hostIdResult = UserId.create(input.hostId);
      if (!hostIdResult.success) {
        return err(hostIdResult.error);
      }

      // 3. プロジェクトの取得
      const project = await this.projectRepository.findById(projectIdResult.data);
      if (!project) {
        return err(notFoundError("プロジェクト"));
      }

      // 4. 所有者確認
      if (!project.hostId.equals(hostIdResult.data)) {
        return err(forbiddenError("このプロジェクトを操作する権限がありません"));
      }

      // 5. プロジェクトの非公開化
      const unpublishResult = project.unpublish();
      if (!unpublishResult.success) {
        return err(unpublishResult.error);
      }

      // 6. リポジトリに保存
      const savedProject = await this.projectRepository.update(unpublishResult.data);

      // 7. 出力DTOに変換して返却
      return ok({
        id: savedProject.id.value,
        title: savedProject.title,
        status: savedProject.status,
      });
    } catch (error) {
      return err(internalError("プロジェクトの非公開化に失敗しました"));
    }
  }
}
