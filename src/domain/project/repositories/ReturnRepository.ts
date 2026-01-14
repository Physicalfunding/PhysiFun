import { Return } from "../entities/Return";
import { ReturnId } from "../value-objects/ReturnId";
import { ProjectId } from "../value-objects/ProjectId";

/**
 * ReturnRepository interface
 * リターンエンティティの永続化を抽象化するリポジトリインターフェース
 */
export interface ReturnRepository {
  /**
   * IDでリターンを検索
   */
  findById(id: ReturnId): Promise<Return | null>;

  /**
   * プロジェクトIDでリターン一覧を取得
   */
  findByProjectId(projectId: ProjectId): Promise<Return[]>;

  /**
   * 新規リターンを作成
   */
  create(returnEntity: Return): Promise<Return>;

  /**
   * リターン情報を更新
   */
  update(returnEntity: Return): Promise<Return>;

  /**
   * リターンを削除
   */
  delete(id: ReturnId): Promise<void>;

  /**
   * プロジェクトのリターン数をカウント
   */
  countByProjectId(projectId: ProjectId): Promise<number>;

  /**
   * プロジェクトのリターン順序を一括更新
   */
  updateOrder(projectId: ProjectId, orderedIds: ReturnId[]): Promise<void>;
}
