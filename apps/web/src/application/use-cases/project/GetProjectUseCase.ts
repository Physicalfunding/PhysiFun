/**
 * GetProjectUseCase
 * プロジェクトの詳細情報を取得するユースケース
 * ホストが自分のプロジェクトを取得する場合に使用
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
import { Category } from "@/domain/project/entities/Project";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * プロジェクト取得の入力データ
 */
export interface GetProjectInput {
  /** プロジェクトID（UUID形式） */
  projectId: string;
  /** 操作を行うユーザーID（所有者確認用） */
  hostId: string;
}

/**
 * プロジェクト取得の出力データ（DTO）
 */
export interface GetProjectOutput {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: Category;
  location: string;
  imageUrls: string[];
  status: string;
  slug: string | null;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

export class GetProjectUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  /**
   * プロジェクト詳細を取得する
   */
  async execute(input: GetProjectInput): Promise<Result<GetProjectOutput, AppError>> {
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
        return err(forbiddenError("このプロジェクトを閲覧する権限がありません"));
      }

      // 5. 出力DTOに変換して返却
      return ok({
        id: project.id.value,
        title: project.title,
        summary: project.summary,
        description: project.description,
        category: project.category,
        location: project.location,
        imageUrls: project.imageUrls,
        status: project.status,
        slug: project.slug,
        isFeatured: project.isFeatured,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        publishedAt: project.publishedAt,
      });
    } catch (error) {
      return err(internalError("プロジェクトの取得に失敗しました"));
    }
  }
}
