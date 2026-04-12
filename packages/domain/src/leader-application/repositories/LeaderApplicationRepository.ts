import type { AccountId } from "../../account/value-objects/AccountId";
import type { LeaderApplication } from "../entities/LeaderApplication";
import type { LeaderApplicationId } from "../value-objects/LeaderApplicationId";

/**
 * LeaderApplication Repository インターフェース
 *
 * 永続化層の実装は `@physifun/infrastructure` に配置し、DI で注入する。
 * ドメイン層はこの interface のみに依存し、Prisma / DB への直接依存を持たない。
 *
 * Phase 1 の具体的な実装は #58 `SubmitLeaderApplicationUseCase` の時点で
 * `PrismaLeaderApplicationRepository` として配置される。
 */
export interface LeaderApplicationRepository {
  /**
   * 新規または既存の LeaderApplication を保存する。
   * 冪等性は呼び出し元（UseCase）で担保する。
   */
  save(application: LeaderApplication): Promise<void>;

  /**
   * ID で 1 件取得する。存在しない場合は null。
   */
  findById(id: LeaderApplicationId): Promise<LeaderApplication | null>;

  /**
   * 指定 Account に紐づく PENDING 状態の応募が存在するかを検証する。
   *
   * `SubmitLeaderApplicationUseCase` の重複チェック（partial unique index 相当）
   * および運営アプリでの審査判定に使う。
   */
  existsPendingByAccountId(accountId: AccountId): Promise<boolean>;
}
