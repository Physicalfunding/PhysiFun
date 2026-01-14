/**
 * UpdateProjectUseCase
 * プロジェクト情報を更新するユースケース
 *
 * 責務:
 * - プロジェクトの所有者確認
 * - プロジェクト情報の更新
 */
import { Result, AppError, ok, err, notFoundError, forbiddenError, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Category } from "@/domain/project/entities/Project";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * プロジェクト更新の入力データ
 * 指定されたフィールドのみ更新される
 */
export interface UpdateProjectInput {
  /** プロジェクトID（UUID形式） */
  projectId: string;
  /** 操作を行うユーザーID（所有者確認用） */
  hostId: string;
  /** 新しいタイトル（省略可） */
  title?: string;
  /** 新しい概要（省略可） */
  summary?: string;
  /** 新しい詳細説明（省略可） */
  description?: string;
  /** 新しいカテゴリ（省略可） */
  category?: Category;
  /** 新しい開催場所（省略可） */
  location?: string;
}

/**
 * プロジェクト更新の出力データ（DTO）
 */
export interface UpdateProjectOutput {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: Category;
  location: string;
  status: string;
  updatedAt: Date;
}

export class UpdateProjectUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  /**
   * プロジェクト情報を更新する
   */
  async execute(input: UpdateProjectInput): Promise<Result<UpdateProjectOutput, AppError>> {
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
        return err(forbiddenError("このプロジェクトを編集する権限がありません"));
      }

      // 5. プロジェクト情報の更新
      const updateResult = project.update({
        title: input.title,
        summary: input.summary,
        description: input.description,
        category: input.category,
        location: input.location,
      });

      if (!updateResult.success) {
        return err(updateResult.error);
      }

      // 6. リポジトリに保存
      const savedProject = await this.projectRepository.update(updateResult.data);

      // 7. 出力DTOに変換して返却
      return ok({
        id: savedProject.id.value,
        title: savedProject.title,
        summary: savedProject.summary,
        description: savedProject.description,
        category: savedProject.category,
        location: savedProject.location,
        status: savedProject.status,
        updatedAt: savedProject.updatedAt,
      });
    } catch (error) {
      return err(internalError("プロジェクトの更新に失敗しました"));
    }
  }
}
