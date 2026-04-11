import { Result, AppError, ok, err, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Category } from "@/domain/project/entities/Project";

/**
 * 公開プロジェクト一覧の出力データ（1件分）
 * ホームページのカード表示に必要な情報のみを含むDTO
 */
export interface PublishedProjectDto {
  id: string;
  title: string;
  summary: string;
  category: Category;
  location: string;
  imageUrl: string | null; // 最初の画像のみ使用
}

/**
 * 公開プロジェクト一覧の出力データ
 */
export interface GetPublishedProjectsOutput {
  projects: PublishedProjectDto[];
}

/**
 * GetPublishedProjectsUseCase
 * 公開中のプロジェクト一覧を取得するユースケース
 *
 * 責務:
 * - 公開中プロジェクトの取得
 * - DTO形式への変換
 *
 * ホームページ表示用のシンプルな実装
 */
export class GetPublishedProjectsUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  /**
   * 公開プロジェクト一覧を取得
   * @returns プロジェクト一覧またはエラー
   */
  async execute(): Promise<Result<GetPublishedProjectsOutput, AppError>> {
    try {
      // 公開中のプロジェクトを全件取得
      const projects = await this.projectRepository.findAllPublished();

      // DTOに変換
      const projectDtos: PublishedProjectDto[] = projects.map((project) => ({
        id: project.id.value,
        title: project.title,
        summary: project.summary,
        category: project.category,
        location: project.location,
        // 画像配列の最初の1枚を使用（なければnull）
        imageUrl: project.imageUrls.length > 0 ? project.imageUrls[0] : null,
      }));

      return ok({ projects: projectDtos });
    } catch (error) {
      // 予期せぬエラーをキャッチしてINTERNAL_ERRORとして返す
      return err(internalError("プロジェクト一覧の取得に失敗しました"));
    }
  }
}
