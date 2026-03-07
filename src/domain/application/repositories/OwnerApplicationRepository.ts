import { OwnerApplication, ApplicationStatus } from "../entities/OwnerApplication";
import { ApplicationId } from "../value-objects/ApplicationId";

/**
 * OwnerApplicationRepository インターフェース
 * オーナー応募の永続化を抽象化
 */
export interface OwnerApplicationRepository {
  /**
   * IDで応募を検索
   */
  findById(id: ApplicationId): Promise<OwnerApplication | null>;

  /**
   * メールアドレスで応募を検索
   */
  findByEmail(email: string): Promise<OwnerApplication[]>;

  /**
   * ステータスで応募を検索
   */
  findByStatus(status: ApplicationStatus): Promise<OwnerApplication[]>;

  /**
   * 新規応募を保存
   */
  create(application: OwnerApplication): Promise<OwnerApplication>;

  /**
   * 応募を更新（ステータス変更など）
   */
  update(application: OwnerApplication): Promise<OwnerApplication>;
}
