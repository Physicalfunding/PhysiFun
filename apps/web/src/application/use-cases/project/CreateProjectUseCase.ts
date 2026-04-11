/**
 * CreateProjectUseCase
 * プロジェクトを新規作成するユースケース
 *
 * 責務:
 * - ホストが既にプロジェクトを持っているかチェック（1アカウント1プロジェクト制限）
 * - 入力バリデーション
 * - プロジェクトエンティティの作成と保存
 */
import { Result, AppError, ok, err, validationError, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Project, Category } from "@/domain/project/entities/Project";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * プロジェクト作成の入力データ
 */
export interface CreateProjectInput {
  /** ホストのユーザーID（UUID形式） */
  hostId: string;
  /** プロジェクトタイトル（必須） */
  title: string;
  /** プロジェクト概要（必須） */
  summary: string;
  /** 詳細説明（必須） */
  description: string;
  /** カテゴリ（KOMINKA, RICE_FARMING, DIY, CRAFT, OTHER） */
  category: Category;
  /** 開催場所 */
  location: string;
}

/**
 * プロジェクト作成の出力データ（DTO）
 */
export interface CreateProjectOutput {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: Category;
  location: string;
  status: string;
  createdAt: Date;
}

// 有効なカテゴリの一覧
const VALID_CATEGORIES: Category[] = ["KOMINKA", "RICE_FARMING", "DIY", "CRAFT", "OTHER"];

export class CreateProjectUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  /**
   * プロジェクトを作成する
   *
   * @param input - プロジェクト作成に必要な入力データ
   * @returns 作成されたプロジェクトのDTOまたはエラー
   */
  async execute(input: CreateProjectInput): Promise<Result<CreateProjectOutput, AppError>> {
    try {
      // 1. ホストIDのバリデーション
      const hostIdResult = UserId.create(input.hostId);
      if (!hostIdResult.success) {
        return err(hostIdResult.error);
      }
      const hostId = hostIdResult.data;

      // 2. カテゴリのバリデーション
      if (!VALID_CATEGORIES.includes(input.category)) {
        return err(validationError("無効なカテゴリが指定されました"));
      }

      // 3. ホストが既にプロジェクトを持っているかチェック
      // ビジネスルール: 1アカウントにつき同時に1プロジェクトのみ作成可能
      const existingCount = await this.projectRepository.countByHostId(hostId);
      if (existingCount > 0) {
        return err(
          validationError(
            "プロジェクトは1アカウントにつき1つのみ作成できます。既存のプロジェクトを編集または削除してください。"
          )
        );
      }

      // 4. プロジェクトIDの生成
      const projectId = ProjectId.generate();

      // 5. プロジェクトエンティティの作成（DRAFT状態）
      const projectResult = Project.create({
        id: projectId,
        hostId,
        title: input.title,
        summary: input.summary,
        description: input.description,
        category: input.category,
        location: input.location,
      });

      if (!projectResult.success) {
        return err(projectResult.error);
      }

      // 6. リポジトリに保存
      const savedProject = await this.projectRepository.create(projectResult.data);

      // 7. 出力DTOに変換して返却
      return ok({
        id: savedProject.id.value,
        title: savedProject.title,
        summary: savedProject.summary,
        description: savedProject.description,
        category: savedProject.category,
        location: savedProject.location,
        status: savedProject.status,
        createdAt: savedProject.createdAt,
      });
    } catch (error) {
      return err(internalError("プロジェクトの作成に失敗しました"));
    }
  }
}
