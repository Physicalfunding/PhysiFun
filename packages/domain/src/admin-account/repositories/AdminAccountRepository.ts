import type { AdminAccount } from "../entities/AdminAccount";
import type { AdminAccountEmail } from "../value-objects/AdminAccountEmail";
import type { AdminAccountId } from "../value-objects/AdminAccountId";

/**
 * AdminAccount 集約のリポジトリ IF (#140 / #144 / #148)
 *
 * 実装は `packages/infrastructure/src/admin-account/` 配下に Prisma で用意する。
 * 本 IF には CRUD 操作 + 運営追加 UI 向けの一覧取得を置く。
 */
export interface AdminAccountRepository {
  /** メールアドレスで AdminAccount を検索する (ログイン時の主検索 / 重複チェック)。 */
  findByEmail(email: AdminAccountEmail): Promise<AdminAccount | null>;

  /** ID で AdminAccount を検索する (UseCase / Route Handler 内の二重防御)。 */
  findById(id: AdminAccountId): Promise<AdminAccount | null>;

  /** 新規 AdminAccount を作成する (seed / 運営追加 UI)。 */
  create(adminAccount: AdminAccount): Promise<void>;

  /** 既存 AdminAccount を更新する (status 変更、lastLoginAt 等)。 */
  update(adminAccount: AdminAccount): Promise<void>;

  /**
   * 全 AdminAccount を createdAt 降順で返す (#148 運営メンバー管理 UI)。
   *
   * 運営総数が十数件規模を超えない想定なのでページングは持たない。
   * 将来的に膨張した場合は { offset, limit } を追加する。
   */
  findAll(): Promise<AdminAccount[]>;
}
