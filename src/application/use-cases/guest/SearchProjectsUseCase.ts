/**
 * SearchProjectsUseCase
 * プロジェクト検索ユースケース
 */
import { Result, AppError, ok, err, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Category } from "@/domain/project/entities/Project";

/**
 * プロジェクト検索入力データ
 */
export interface SearchProjectsInput {
  keyword?: string;
  category?: Category;
  location?: string;
  page?: number;
  limit?: number;
}

/**
 * プロジェクト出力データ
 */
export interface ProjectSearchItem {
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
 * プロジェクト検索出力データ
 */
export interface SearchProjectsOutput {
  items: ProjectSearchItem[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export class SearchProjectsUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository
  ) {}

  /**
   * プロジェクトを検索
   * @param input 検索条件
   * @returns 検索結果
   */
  async execute(input: SearchProjectsInput): Promise<Result<SearchProjectsOutput, AppError>> {
    try {
      const page = input.page ?? 1;
      const limit = input.limit ?? 10;

      // 1. 公開プロジェクトの検索
      const result = await this.projectRepository.findPublished({
        keyword: input.keyword,
        category: input.category,
        location: input.location,
        page,
        limit,
      });

      // 2. 出力DTOに変換して返却
      return ok({
        items: result.items.map((p) => ({
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
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasNext: result.hasNext,
      });
    } catch (error) {
      console.error("Failed to search projects:", error);
      return err(internalError("プロジェクトの検索に失敗しました"));
    }
  }
}
