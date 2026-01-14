/**
 * DeleteScheduleUseCase
 * 体験スケジュールを削除するユースケース
 */
import { Result, AppError, ok, err, notFoundError, forbiddenError, conflictError, internalError } from "@/domain/shared/result";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { ScheduleRepository } from "@/domain/schedule/repositories/ScheduleRepository";
import { ParticipationRepository } from "@/domain/participation/repositories/ParticipationRepository";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";

/**
 * スケジュール削除入力データ
 */
export interface DeleteScheduleInput {
  scheduleId: string;
  hostId: string;
  force?: boolean; // 参加申込がある場合でも削除するか
}

/**
 * スケジュール削除出力データ
 */
export interface DeleteScheduleOutput {
  deletedScheduleId: string;
}

export class DeleteScheduleUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly scheduleRepository: ScheduleRepository,
    private readonly participationRepository: ParticipationRepository
  ) {}

  /**
   * 体験スケジュールを削除
   * @param input 削除入力データ
   * @returns 削除結果
   */
  async execute(input: DeleteScheduleInput): Promise<Result<DeleteScheduleOutput, AppError>> {
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
        return err(forbiddenError("このスケジュールを削除する権限がありません"));
      }

      // 5. 参加申込の確認
      const participationCount = await this.participationRepository.countByScheduleId(
        scheduleIdResult.data
      );

      if (participationCount > 0 && !input.force) {
        return err(
          conflictError(
            `このスケジュールには${participationCount}件の参加申込があります。削除するには参加者への連絡が必要です。`
          )
        );
      }

      // 6. スケジュールの削除
      await this.scheduleRepository.delete(scheduleIdResult.data);

      // 7. 結果を返却
      return ok({
        deletedScheduleId: input.scheduleId,
      });
    } catch (error) {
      console.error("Failed to delete schedule:", error);
      return err(internalError("スケジュールの削除に失敗しました"));
    }
  }
}
