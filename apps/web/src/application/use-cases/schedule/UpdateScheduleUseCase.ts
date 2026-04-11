/**
 * UpdateScheduleUseCase
 * 体験スケジュールを更新するユースケース
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
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";

/**
 * スケジュール更新入力データ
 */
export interface UpdateScheduleInput {
  scheduleId: string;
  hostId: string;
  title?: string;
  description?: string;
  startDateTime?: Date;
  duration?: number | null;
  capacity?: number;
  requirements?: string | null;
}

/**
 * スケジュール更新出力データ
 */
export interface UpdateScheduleOutput {
  id: string;
  projectId: string;
  title: string;
  description: string;
  startDateTime: Date;
  duration: number | null;
  capacity: number;
  requirements: string | null;
  updatedAt: Date;
}

export class UpdateScheduleUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly scheduleRepository: ScheduleRepository
  ) {}

  /**
   * 体験スケジュールを更新
   * @param input 更新入力データ
   * @returns 更新結果
   */
  async execute(input: UpdateScheduleInput): Promise<Result<UpdateScheduleOutput, AppError>> {
    try {
      // 1. スケジュールIDのバリデーション
      const scheduleIdResult = ScheduleId.create(input.scheduleId);
      if (!scheduleIdResult.success) {
        return err(scheduleIdResult.error);
      }

      // 2. スケジュールの取得
      const schedule = await this.scheduleRepository.findById(scheduleIdResult.data);
      if (!schedule) {
        return err(notFoundError("スケジュールが見つかりません"));
      }

      // 3. プロジェクトの取得（オーナー確認用）
      const project = await this.projectRepository.findById(schedule.projectId);
      if (!project) {
        return err(notFoundError("プロジェクトが見つかりません"));
      }

      // 4. オーナーチェック
      if (project.hostId.value !== input.hostId) {
        return err(forbiddenError("このスケジュールを更新する権限がありません"));
      }

      // 5. スケジュールの更新
      const updateResult = schedule.update({
        title: input.title,
        description: input.description,
        startDateTime: input.startDateTime,
        duration: input.duration,
        capacity: input.capacity,
        requirements: input.requirements,
      });

      if (!updateResult.success) {
        return err(updateResult.error);
      }

      // 6. リポジトリに保存
      const updatedSchedule = await this.scheduleRepository.update(updateResult.data);

      // 7. 出力DTOに変換して返却
      return ok({
        id: updatedSchedule.id.value,
        projectId: updatedSchedule.projectId.value,
        title: updatedSchedule.title,
        description: updatedSchedule.description,
        startDateTime: updatedSchedule.startDateTime,
        duration: updatedSchedule.duration,
        capacity: updatedSchedule.capacity,
        requirements: updatedSchedule.requirements,
        updatedAt: updatedSchedule.updatedAt,
      });
    } catch (error) {
      console.error("Failed to update schedule:", error);
      return err(internalError("スケジュールの更新に失敗しました"));
    }
  }
}
