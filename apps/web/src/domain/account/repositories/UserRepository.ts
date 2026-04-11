import { User } from "../entities/User";
import { Email } from "../value-objects/Email";
import { UserId } from "../value-objects/UserId";

/**
 * UserRepository interface
 * ユーザーエンティティの永続化を抽象化するリポジトリインターフェース
 * ドメイン層に定義し、インフラ層で具体的な実装を提供する
 */
export interface UserRepository {
  /**
   * IDでユーザーを検索
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * メールアドレスでユーザーを検索
   */
  findByEmail(email: Email): Promise<User | null>;

  /**
   * 新規ユーザーを作成
   */
  create(user: User): Promise<User>;

  /**
   * ユーザー情報を更新
   */
  update(user: User): Promise<User>;
}
