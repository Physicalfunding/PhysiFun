import { Schedule } from "../entities/Schedule";
import { ScheduleId } from "../value-objects/ScheduleId";
import { ProjectId } from "../../project/value-objects/ProjectId";

/**
 * ScheduleRepository interface
 * 体験スケジュールエンティティの永続化を抽象化するリポジトリインターフェース
 * ドメイン層に定義し、インフラ層で具体的な実装を提供する
 */
export interface ScheduleRepository {
  /**
   * IDでスケジュールを検索
   */
  findById(id: ScheduleId): Promise<Schedule | null>;

  /**
   * プロジェクトIDでスケジュール一覧を取得
   */
  findByProjectId(projectId: ProjectId): Promise<Schedule[]>;

  /**
   * プロジェクトIDで今後のスケジュール一覧を取得（開催日時が未来のもの）
   */
  findUpcomingByProjectId(projectId: ProjectId): Promise<Schedule[]>;

  /**
   * 新規スケジュールを作成
   */
  create(schedule: Schedule): Promise<Schedule>;

  /**
   * スケジュール情報を更新
   */
  update(schedule: Schedule): Promise<Schedule>;

  /**
   * スケジュールを削除
   */
  delete(id: ScheduleId): Promise<void>;

  /**
   * プロジェクトのスケジュール数をカウント
   */
  countByProjectId(projectId: ProjectId): Promise<number>;
}
