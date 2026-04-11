import { type Result, type AppError, ok, err } from "@/domain/shared/result";
import { ParticipationRepository } from "@/domain/participation/repositories/ParticipationRepository";
import { Participation, ParticipationStatus } from "@/domain/participation/entities/Participation";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * GetMyParticipationsUseCase 入力パラメータ
 */
interface GetMyParticipationsInput {
  userId: string;
  excludeCancelled?: boolean; // キャンセル済みを除外するか
}

/**
 * GetMyParticipationsUseCase
 * ログインユーザーの参加予定一覧を取得するユースケース
 *
 * 主な責務:
 * - ユーザーの参加予定取得
 * - キャンセル済みのフィルタリング
 */
export class GetMyParticipationsUseCase {
  constructor(private readonly participationRepository: ParticipationRepository) {}

  /**
   * 参加予定一覧を取得
   */
  async execute(input: GetMyParticipationsInput): Promise<Result<Participation[], AppError>> {
    // 1. 入力値のバリデーション
    const userIdResult = UserId.create(input.userId);
    if (!userIdResult.success) {
      return userIdResult;
    }

    // 2. 参加予定一覧を取得
    let participations = await this.participationRepository.findByUserId(userIdResult.data);

    // 3. キャンセル済みを除外（オプション）
    if (input.excludeCancelled) {
      participations = participations.filter((p) => p.status !== ParticipationStatus.CANCELLED);
    }

    return ok(participations);
  }
}
