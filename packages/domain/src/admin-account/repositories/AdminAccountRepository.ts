import type { AdminAccount } from "../entities/AdminAccount";
import type { AdminAccountEmail } from "../value-objects/AdminAccountEmail";
import type { AdminAccountId } from "../value-objects/AdminAccountId";

/**
 * AdminAccount 集約のリポジトリ IF (#140 / #144)
 *
 * 実装は `packages/infrastructure/src/admin-account/` 配下に Prisma で用意する (#140-2 以降)。
 * 本 IF には #140-2 以降で必要になる最小限の参照・更新メソッドのみを置く。
 */
export interface AdminAccountRepository {
  /** メールアドレスで AdminAccount を検索する (ログイン時の主検索)。 */
  findByEmail(email: AdminAccountEmail): Promise<AdminAccount | null>;

  /** ID で AdminAccount を検索する (UseCase 内の二重防御)。 */
  findById(id: AdminAccountId): Promise<AdminAccount | null>;

  /** 新規 AdminAccount を作成する (seed / 運営追加 UI)。 */
  create(adminAccount: AdminAccount): Promise<void>;

  /** 既存 AdminAccount を更新する (TOTP 設定、status 変更、lastLoginAt 等)。 */
  update(adminAccount: AdminAccount): Promise<void>;
}
