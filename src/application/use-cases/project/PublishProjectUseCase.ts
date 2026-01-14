/**
 * PublishProjectUseCase
 * プロジェクトを公開するユースケース
 *
 * 責務:
 * - プロジェクトの所有者確認
 * - プロジェクトの公開状態への変更
 * - URLスラッグの生成
 */
import { Result, AppError, ok, err, notFoundError, forbiddenError, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Category } from "@/domain/project/entities/Project";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * プロジェクト公開の入力データ
 */
export interface PublishProjectInput {
  /** プロジェクトID（UUID形式） */
  projectId: string;
  /** 操作を行うユーザーID（所有者確認用） */
  hostId: string;
}

/**
 * プロジェクト公開の出力データ（DTO）
 */
export interface PublishProjectOutput {
  id: string;
  title: string;
  status: string;
  slug: string | null;
  publishedAt: Date | null;
}

export class PublishProjectUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  /**
   * プロジェクトを公開する
   */
  async execute(input: PublishProjectInput): Promise<Result<PublishProjectOutput, AppError>> {
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
        return err(forbiddenError("このプロジェクトを公開する権限がありません"));
      }

      // 5. プロジェクトの公開
      const publishResult = project.publish();
      if (!publishResult.success) {
        return err(publishResult.error);
      }

      // 6. リポジトリに保存
      const savedProject = await this.projectRepository.update(publishResult.data);

      // 7. 出力DTOに変換して返却
      return ok({
        id: savedProject.id.value,
        title: savedProject.title,
        status: savedProject.status,
        slug: savedProject.slug,
        publishedAt: savedProject.publishedAt,
      });
    } catch (error) {
      return err(internalError("プロジェクトの公開に失敗しました"));
    }
  }
}
