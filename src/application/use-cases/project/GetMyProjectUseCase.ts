/**
 * GetMyProjectUseCase
 * ホストが自分のプロジェクト（1つのみ）を取得するユースケース
 */
import { Result, AppError, ok, err, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Category } from "@/domain/project/entities/Project";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * マイプロジェクトの出力データ（DTO）
 */
export interface MyProjectOutput {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: Category;
  location: string;
  imageUrls: string[];
  status: string;
  slug: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

export class GetMyProjectUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  /**
   * ホストのプロジェクトを取得
   * @param hostId ホストのユーザーID
   * @returns プロジェクト（存在しない場合はnull）
   */
  async execute(hostId: string): Promise<Result<MyProjectOutput | null, AppError>> {
    try {
      // 1. ホストIDのバリデーション
      const hostIdResult = UserId.create(hostId);
      if (!hostIdResult.success) {
        return err(hostIdResult.error);
      }

      // 2. ホストのプロジェクトを取得
      const projects = await this.projectRepository.findByHostId(hostIdResult.data);

      // プロジェクトがない場合はnullを返す
      if (projects.length === 0) {
        return ok(null);
      }

      // 最初のプロジェクト（1アカウント1プロジェクトの制限があるため）
      const project = projects[0];

      // 3. 出力DTOに変換して返却
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
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        publishedAt: project.publishedAt,
      });
    } catch (error) {
      return err(internalError("プロジェクトの取得に失敗しました"));
    }
  }
}
