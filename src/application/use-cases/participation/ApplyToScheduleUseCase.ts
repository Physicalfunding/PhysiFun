import {
  type Result,
  type AppError,
  ok,
  err,
  notFoundError,
  conflictError,
  validationError,
} from "@/domain/shared/result";
import { ParticipationRepository } from "@/domain/participation/repositories/ParticipationRepository";
import { ScheduleRepository } from "@/domain/schedule/repositories/ScheduleRepository";
import { Participation } from "@/domain/participation/entities/Participation";
import { ParticipationId } from "@/domain/participation/value-objects/ParticipationId";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * ApplyToScheduleUseCase 入力パラメータ
 */
interface ApplyToScheduleInput {
  userId: string;
  scheduleId: string;
  participantCount: number;
}

/**
 * ApplyToScheduleUseCase
 * 体験スケジュールへの参加申し込みを処理するユースケース
 *
 * 主な責務:
 * - スケジュールの存在確認
 * - 重複申し込みチェック
 * - 定員チェック
 * - 参加申し込みの作成
 */
export class ApplyToScheduleUseCase {
  constructor(
    private readonly participationRepository: ParticipationRepository,
    private readonly scheduleRepository: ScheduleRepository
  ) {}

  /**
   * 参加申し込みを実行
   */
  async execute(input: ApplyToScheduleInput): Promise<Result<Participation, AppError>> {
    // 1. 入力値のバリデーション（値オブジェクトへの変換）
    const userIdResult = UserId.create(input.userId);
    if (!userIdResult.success) {
      return userIdResult;
    }

    const scheduleIdResult = ScheduleId.create(input.scheduleId);
    if (!scheduleIdResult.success) {
      return scheduleIdResult;
    }

    const userId = userIdResult.data;
    const scheduleId = scheduleIdResult.data;

    // 2. スケジュールの存在確認
    const schedule = await this.scheduleRepository.findById(scheduleId);
    if (!schedule) {
      return err(notFoundError("スケジュール"));
    }

    // 3. 過去のスケジュールかどうかチェック
    if (schedule.isPast()) {
      return err(validationError("この体験は既に終了しています"));
    }

    // 4. 重複申し込みチェック
    const existingParticipation = await this.participationRepository.findByUserIdAndScheduleId(
      userId,
      scheduleId
    );
    if (existingParticipation) {
      return err(conflictError("このスケジュールには既に申し込み済みです"));
    }

    // 5. 定員チェック
    const currentParticipantCount =
      await this.participationRepository.sumParticipantCountByScheduleId(scheduleId);
    const remainingCapacity = schedule.capacity - currentParticipantCount;

    if (input.participantCount > remainingCapacity) {
      return err(
        validationError(
          `定員を超えています。現在の残り枠: ${remainingCapacity}名`
        )
      );
    }

    // 6. 参加申し込みエンティティの作成
    const participationId = ParticipationId.generate();
    const participationResult = Participation.create({
      id: participationId,
      guestId: userId,
      scheduleId: scheduleId,
      participantCount: input.participantCount,
    });

    if (!participationResult.success) {
      return participationResult;
    }

    // 7. 永続化
    const savedParticipation = await this.participationRepository.create(participationResult.data);

    return ok(savedParticipation);
  }
}
