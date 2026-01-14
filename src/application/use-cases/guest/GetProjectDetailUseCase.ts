/**
 * GetProjectDetailUseCase
 * プロジェクト詳細取得ユースケース
 */
import { Result, AppError, ok, err, notFoundError, validationError, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { ReturnRepository } from "@/domain/project/repositories/ReturnRepository";
import { ScheduleRepository } from "@/domain/schedule/repositories/ScheduleRepository";
import { UserRepository } from "@/domain/account/repositories/UserRepository";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { Category, ProjectStatus } from "@/domain/project/entities/Project";

/**
 * プロジェクト詳細取得入力データ
 */
export interface GetProjectDetailInput {
  slug?: string;
  projectId?: string;
}

/**
 * ホスト情報出力データ
 */
export interface HostInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
}

/**
 * リターン出力データ
 */
export interface ReturnInfo {
  id: string;
  name: string;
  description: string;
  estimatedDeliveryDate: Date | null;
  quantityLimit: number | null;
  order: number;
}

/**
 * スケジュール出力データ
 */
export interface ScheduleInfo {
  id: string;
  title: string;
  description: string | null;
  startDateTime: Date;
  duration: number | null;
  capacity: number;
  requirements: string | null;
}

/**
 * プロジェクト詳細取得出力データ
 */
export interface GetProjectDetailOutput {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: Category;
  location: string;
  imageUrls: string[];
  slug: string | null;
  isFeatured: boolean;
  publishedAt: Date | null;
  host: HostInfo;
  returns: ReturnInfo[];
  schedules: ScheduleInfo[];
}

export class GetProjectDetailUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly returnRepository: ReturnRepository,
    private readonly scheduleRepository: ScheduleRepository,
    private readonly userRepository: UserRepository
  ) {}

  /**
   * プロジェクト詳細を取得
   * @param input 取得条件
   * @returns 取得結果
   */
  async execute(input: GetProjectDetailInput): Promise<Result<GetProjectDetailOutput, AppError>> {
    try {
      // 1. 入力バリデーション
      if (!input.slug && !input.projectId) {
        return err(validationError("スラッグまたはプロジェクトIDを指定してください"));
      }

      // 2. プロジェクトの取得
      let project;
      if (input.slug) {
        project = await this.projectRepository.findBySlug(input.slug);
      } else if (input.projectId) {
        const projectIdResult = ProjectId.create(input.projectId);
        if (!projectIdResult.success) {
          return err(projectIdResult.error);
        }
        project = await this.projectRepository.findById(projectIdResult.data);
      }

      if (!project) {
        return err(notFoundError("プロジェクトが見つかりません"));
      }

      // 3. 公開チェック
      if (project.status !== ProjectStatus.PUBLISHED) {
        return err(notFoundError("プロジェクトが見つかりません"));
      }

      // 4. ホスト情報の取得
      const host = await this.userRepository.findById(project.hostId);
      if (!host) {
        return err(notFoundError("ホスト情報が見つかりません"));
      }

      // 5. リターン一覧の取得
      const returns = await this.returnRepository.findByProjectId(project.id);

      // 6. スケジュール一覧の取得（今後のスケジュールのみ）
      const schedules = await this.scheduleRepository.findUpcomingByProjectId(project.id);

      // 7. 出力DTOに変換して返却
      return ok({
        id: project.id.value,
        title: project.title,
        summary: project.summary,
        description: project.description,
        category: project.category,
        location: project.location,
        imageUrls: project.imageUrls,
        slug: project.slug,
        isFeatured: project.isFeatured,
        publishedAt: project.publishedAt,
        host: {
          id: host.id.value,
          name: host.name,
          avatarUrl: host.avatarUrl,
          bio: host.bio,
        },
        returns: returns.map((r) => ({
          id: r.id.value,
          name: r.name,
          description: r.description,
          estimatedDeliveryDate: r.estimatedDeliveryDate,
          quantityLimit: r.quantityLimit,
          order: r.order,
        })),
        schedules: schedules.map((s) => ({
          id: s.id.value,
          title: s.title,
          description: s.description,
          startDateTime: s.startDateTime,
          duration: s.duration,
          capacity: s.capacity,
          requirements: s.requirements,
        })),
      });
    } catch (error) {
      console.error("Failed to get project detail:", error);
      return err(internalError("プロジェクト詳細の取得に失敗しました"));
    }
  }
}
