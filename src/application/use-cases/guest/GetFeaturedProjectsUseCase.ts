/**
 * GetFeaturedProjectsUseCase
 * ホームページ表示用のプロジェクト取得ユースケース
 */
import { Result, AppError, ok, err, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Category } from "@/domain/project/entities/Project";

/**
 * ホームページ取得入力データ
 */
export interface GetFeaturedProjectsInput {
  category?: Category;
  location?: string;
  limit?: number;
}

/**
 * プロジェクト出力データ
 */
export interface ProjectSummary {
  id: string;
  title: string;
  summary: string;
  category: Category;
  location: string;
  imageUrl: string | null;
  slug: string | null;
  isFeatured: boolean;
  publishedAt: Date | null;
}

/**
 * ホームページ取得出力データ
 */
export interface GetFeaturedProjectsOutput {
  featured: ProjectSummary[];
  recent: ProjectSummary[];
}

export class GetFeaturedProjectsUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  /**
   * ホームページ用のプロジェクトを取得
   * @param input 取得条件
   * @returns 取得結果
   */
  async execute(
    input: GetFeaturedProjectsInput
  ): Promise<Result<GetFeaturedProjectsOutput, AppError>> {
    try {
      const limit = input.limit ?? 10;

      // 1. ピックアッププロジェクトの取得
      const featuredProjects = await this.projectRepository.findFeatured();

      // 2. 最新の公開プロジェクトの取得
      const recentResult = await this.projectRepository.findPublished({
        category: input.category,
        location: input.location,
        page: 1,
        limit,
      });

      // 3. 出力DTOに変換して返却
      return ok({
        featured: featuredProjects.map((p) => ({
          id: p.id.value,
          title: p.title,
          summary: p.summary,
          category: p.category,
          location: p.location,
          imageUrl: p.imageUrls.length > 0 ? p.imageUrls[0] : null,
          slug: p.slug,
          isFeatured: p.isFeatured,
          publishedAt: p.publishedAt,
        })),
        recent: recentResult.items.map((p) => ({
          id: p.id.value,
          title: p.title,
          summary: p.summary,
          category: p.category,
          location: p.location,
          imageUrl: p.imageUrls.length > 0 ? p.imageUrls[0] : null,
          slug: p.slug,
          isFeatured: p.isFeatured,
          publishedAt: p.publishedAt,
        })),
      });
    } catch (error) {
      console.error("Failed to get featured projects:", error);
      return err(internalError("プロジェクトの取得に失敗しました"));
    }
  }
}
