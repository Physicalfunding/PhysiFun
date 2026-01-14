import { Participation } from "../entities/Participation";
import { ParticipationId } from "../value-objects/ParticipationId";
import { ScheduleId } from "../../schedule/value-objects/ScheduleId";
import { UserId } from "../../account/value-objects/UserId";

/**
 * ParticipationRepository interface
 * 参加申込エンティティの永続化を抽象化するリポジトリインターフェース
 */
export interface ParticipationRepository {
  /**
   * IDで参加申込を検索
   */
  findById(id: ParticipationId): Promise<Participation | null>;

  /**
   * スケジュールIDで参加申込一覧を取得
   */
  findByScheduleId(scheduleId: ScheduleId): Promise<Participation[]>;

  /**
   * ユーザーIDで参加申込一覧を取得
   */
  findByUserId(userId: UserId): Promise<Participation[]>;

  /**
   * ユーザーIDとスケジュールIDで参加申込を検索
   */
  findByUserIdAndScheduleId(userId: UserId, scheduleId: ScheduleId): Promise<Participation | null>;

  /**
   * 新規参加申込を作成
   */
  create(participation: Participation): Promise<Participation>;

  /**
   * 参加申込情報を更新
   */
  update(participation: Participation): Promise<Participation>;

  /**
   * 参加申込を削除
   */
  delete(id: ParticipationId): Promise<void>;

  /**
   * スケジュールの参加申込数をカウント
   */
  countByScheduleId(scheduleId: ScheduleId): Promise<number>;

  /**
   * スケジュールの合計参加人数をカウント
   */
  sumParticipantCountByScheduleId(scheduleId: ScheduleId): Promise<number>;
}
