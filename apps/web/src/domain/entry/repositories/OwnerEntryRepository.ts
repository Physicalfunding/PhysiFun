import { OwnerEntry, EntryStatus } from "../entities/OwnerEntry";
import { EntryId } from "../value-objects/EntryId";

/**
 * OwnerEntryRepository インターフェース
 * オーナー応募の永続化を抽象化
 */
export interface OwnerEntryRepository {
  /**
   * IDで応募を検索
   */
  findById(id: EntryId): Promise<OwnerEntry | null>;

  /**
   * メールアドレスで応募を検索
   */
  findByEmail(email: string): Promise<OwnerEntry[]>;

  /**
   * ステータスで応募を検索
   */
  findByStatus(status: EntryStatus): Promise<OwnerEntry[]>;

  /**
   * 新規応募を保存
   */
  create(entry: OwnerEntry): Promise<OwnerEntry>;

  /**
   * 応募を更新（ステータス変更など）
   */
  update(entry: OwnerEntry): Promise<OwnerEntry>;
}
