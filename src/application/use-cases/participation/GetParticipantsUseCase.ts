import {
  type Result,
  type AppError,
  ok,
  err,
  notFoundError,
  forbiddenError,
} from "@/domain/shared/result";
import { ParticipationRepository } from "@/domain/participation/repositories/ParticipationRepository";
import { ScheduleRepository } from "@/domain/schedule/repositories/ScheduleRepository";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Participation } from "@/domain/participation/entities/Participation";
import { Schedule } from "@/domain/schedule/entities/Schedule";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * GetParticipantsUseCase 入力パラメータ
 */
interface GetParticipantsInput {
  scheduleId: string;
  hostId: string; // リクエストしたホストのID（権限チェック用）
}

/**
 * GetParticipantsUseCase 出力
 */
interface GetParticipantsOutput {
  schedule: {
    id: string;
    title: string;
    startDateTime: Date;
    capacity: number;
  };
  participants: Participation[];
  currentParticipantCount: number;
}

/**
 * GetParticipantsUseCase
 * スケジュールの参加者一覧を取得するユースケース（ホスト向け）
 *
 * 主な責務:
 * - スケジュールの存在確認
 * - ホスト権限の確認
 * - 参加者一覧の取得
 * - 現在の参加人数の集計
 */
export class GetParticipantsUseCase {
  constructor(
    private readonly participationRepository: ParticipationRepository,
    private readonly scheduleRepository: ScheduleRepository,
    private readonly projectRepository: ProjectRepository
  ) {}

  /**
   * 参加者一覧を取得
   */
  async execute(input: GetParticipantsInput): Promise<Result<GetParticipantsOutput, AppError>> {
    // 1. 入力値のバリデーション
    const scheduleIdResult = ScheduleId.create(input.scheduleId);
    if (!scheduleIdResult.success) {
      return scheduleIdResult;
    }

    const hostIdResult = UserId.create(input.hostId);
    if (!hostIdResult.success) {
      return hostIdResult;
    }

    const scheduleId = scheduleIdResult.data;
    const hostId = hostIdResult.data;

    // 2. スケジュールの存在確認
    const schedule = await this.scheduleRepository.findById(scheduleId);
    if (!schedule) {
      return err(notFoundError("スケジュール"));
    }

    // 3. プロジェクトの取得とホスト権限チェック
    const project = await this.projectRepository.findById(schedule.projectId);
    if (!project) {
      return err(notFoundError("プロジェクト"));
    }

    if (!project.hostId.equals(hostId)) {
      return err(forbiddenError("このスケジュールの参加者を閲覧する権限がありません"));
    }

    // 4. 参加者一覧の取得
    const participants = await this.participationRepository.findByScheduleId(scheduleId);

    // 5. 現在の参加人数を集計
    const currentParticipantCount = participants.reduce(
      (sum, p) => sum + p.participantCount,
      0
    );

    return ok({
      schedule: {
        id: schedule.id.value,
        title: schedule.title,
        startDateTime: schedule.startDateTime,
        capacity: schedule.capacity,
      },
      participants,
      currentParticipantCount,
    });
  }
}
