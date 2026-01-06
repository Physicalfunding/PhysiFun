import { Project, ProjectStatus } from "../entities/Project";
import { ProjectId } from "../value-objects/ProjectId";
import { UserId } from "../../account/value-objects/UserId";

/**
 * プロジェクト検索のフィルター条件
 */
export interface ProjectFilter {
  keyword?: string;
  category?: string;
  location?: string;
  page: number;
  limit: number;
}

/**
 * ページネーション付き検索結果
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

/**
 * ProjectRepository interface
 * プロジェクトエンティティの永続化を抽象化するリポジトリインターフェース
 * ドメイン層に定義し、インフラ層で具体的な実装を提供する
 */
export interface ProjectRepository {
  /**
   * IDでプロジェクトを検索
   */
  findById(id: ProjectId): Promise<Project | null>;

  /**
   * スラッグでプロジェクトを検索
   */
  findBySlug(slug: string): Promise<Project | null>;

  /**
   * ホストIDでプロジェクトを検索
   */
  findByHostId(hostId: UserId): Promise<Project[]>;

  /**
   * 公開中のプロジェクトをフィルター条件で検索
   */
  findPublished(filter: ProjectFilter): Promise<PaginatedResult<Project>>;

  /**
   * 公開中の全プロジェクトを取得（シンプル版）
   */
  findAllPublished(): Promise<Project[]>;

  /**
   * ピックアップ（注目）プロジェクトを取得
   */
  findFeatured(): Promise<Project[]>;

  /**
   * 新規プロジェクトを作成
   */
  create(project: Project): Promise<Project>;

  /**
   * プロジェクト情報を更新
   */
  update(project: Project): Promise<Project>;

  /**
   * プロジェクトを削除
   */
  delete(id: ProjectId): Promise<void>;

  /**
   * ホストが持つプロジェクト数をカウント
   */
  countByHostId(hostId: UserId, status?: ProjectStatus): Promise<number>;
}
