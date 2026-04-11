/**
 * GetSchedulesUseCase
 * プロジェクトの体験スケジュール一覧を取得するユースケース
 */
import { Result, AppError, ok, err, notFoundError, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { ScheduleRepository } from "@/domain/schedule/repositories/ScheduleRepository";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";

/**
 * スケジュール一覧取得入力データ
 */
export interface GetSchedulesInput {
  projectId: string;
  upcomingOnly?: boolean; // 今後のスケジュールのみ取得
}

/**
 * スケジュール出力データ
 */
export interface ScheduleOutput {
  id: string;
  title: string;
  description: string;
  startDateTime: Date;
  duration: number | null;
  capacity: number;
  requirements: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * スケジュール一覧取得出力データ
 */
export interface GetSchedulesOutput {
  projectId: string;
  schedules: ScheduleOutput[];
}

export class GetSchedulesUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly scheduleRepository: ScheduleRepository
  ) {}

  /**
   * プロジェクトの体験スケジュール一覧を取得
   * @param input 取得入力データ
   * @returns スケジュール一覧
   */
  async execute(input: GetSchedulesInput): Promise<Result<GetSchedulesOutput, AppError>> {
    try {
      // 1. プロジェクトIDのバリデーション
      const projectIdResult = ProjectId.create(input.projectId);
      if (!projectIdResult.success) {
        return err(projectIdResult.error);
      }

      // 2. プロジェクトの存在確認
      const project = await this.projectRepository.findById(projectIdResult.data);
      if (!project) {
        return err(notFoundError("プロジェクトが見つかりません"));
      }

      // 3. スケジュール一覧の取得
      const schedules = input.upcomingOnly
        ? await this.scheduleRepository.findUpcomingByProjectId(projectIdResult.data)
        : await this.scheduleRepository.findByProjectId(projectIdResult.data);

      // 4. 出力DTOに変換して返却
      return ok({
        projectId: input.projectId,
        schedules: schedules.map((schedule) => ({
          id: schedule.id.value,
          title: schedule.title,
          description: schedule.description,
          startDateTime: schedule.startDateTime,
          duration: schedule.duration,
          capacity: schedule.capacity,
          requirements: schedule.requirements,
          createdAt: schedule.createdAt,
          updatedAt: schedule.updatedAt,
        })),
      });
    } catch (error) {
      console.error("Failed to get schedules:", error);
      return err(internalError("スケジュールの取得に失敗しました"));
    }
  }
}
