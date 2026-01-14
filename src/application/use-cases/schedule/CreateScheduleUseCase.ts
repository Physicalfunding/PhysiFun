/**
 * CreateScheduleUseCase
 * 体験スケジュールを作成するユースケース
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
import { ScheduleRepository } from "@/domain/schedule/repositories/ScheduleRepository";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";
import { Schedule } from "@/domain/schedule/entities/Schedule";

/**
 * スケジュール作成入力データ
 */
export interface CreateScheduleInput {
  projectId: string;
  hostId: string;
  title: string;
  description: string;
  startDateTime: Date;
  duration?: number | null;
  capacity: number;
  requirements?: string | null;
}

/**
 * スケジュール作成出力データ
 */
export interface CreateScheduleOutput {
  id: string;
  projectId: string;
  title: string;
  description: string;
  startDateTime: Date;
  duration: number | null;
  capacity: number;
  requirements: string | null;
  createdAt: Date;
}

export class CreateScheduleUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly scheduleRepository: ScheduleRepository
  ) {}

  /**
   * 体験スケジュールを作成
   * @param input 作成入力データ
   * @returns 作成結果
   */
  async execute(input: CreateScheduleInput): Promise<Result<CreateScheduleOutput, AppError>> {
    try {
      // 1. プロジェクトIDのバリデーション
      const projectIdResult = ProjectId.create(input.projectId);
      if (!projectIdResult.success) {
        return err(projectIdResult.error);
      }

      // 2. プロジェクトの取得
      const project = await this.projectRepository.findById(projectIdResult.data);
      if (!project) {
        return err(notFoundError("プロジェクトが見つかりません"));
      }

      // 3. オーナーチェック
      if (project.hostId.value !== input.hostId) {
        return err(forbiddenError("このプロジェクトにスケジュールを追加する権限がありません"));
      }

      // 4. スケジュールIDの生成
      const scheduleId = ScheduleId.generate();

      // 5. スケジュールエンティティの作成
      const scheduleResult = Schedule.create({
        id: scheduleId,
        projectId: projectIdResult.data,
        title: input.title,
        description: input.description,
        startDateTime: input.startDateTime,
        duration: input.duration,
        capacity: input.capacity,
        requirements: input.requirements,
      });

      if (!scheduleResult.success) {
        return err(scheduleResult.error);
      }

      // 6. リポジトリに保存
      const savedSchedule = await this.scheduleRepository.create(scheduleResult.data);

      // 7. 出力DTOに変換して返却
      return ok({
        id: savedSchedule.id.value,
        projectId: savedSchedule.projectId.value,
        title: savedSchedule.title,
        description: savedSchedule.description,
        startDateTime: savedSchedule.startDateTime,
        duration: savedSchedule.duration,
        capacity: savedSchedule.capacity,
        requirements: savedSchedule.requirements,
        createdAt: savedSchedule.createdAt,
      });
    } catch (error) {
      console.error("Failed to create schedule:", error);
      return err(internalError("スケジュールの作成に失敗しました"));
    }
  }
}
