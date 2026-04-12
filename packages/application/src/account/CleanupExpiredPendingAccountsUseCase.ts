import { ok, err, type Result } from "@physifun/domain";

/**
 * 期限切れ PENDING_EMAIL_CONFIRMATION アカウントの自動削除 UseCase
 *
 * B-5 仮値: 72 時間経過した未アクティベーションアカウントを削除する。
 * LeaderApplication は Account の CASCADE 削除で自動的に削除される。
 */

/** カットオフまでの時間 (時間) */
const EXPIRY_HOURS = 72; // B-5 仮値

/** 期限切れアカウント削除用のポートインターフェース */
export interface CleanupExpiredAccountsPort {
  /** olderThan より前に作成された PENDING_EMAIL_CONFIRMATION アカウントを削除し、削除件数を返す */
  deleteExpiredPendingAccounts(olderThan: Date): Promise<number>;
}

export type CleanupExpiredAccountsResult = {
  deletedCount: number;
};

export type CleanupExpiredAccountsError = {
  type: "CLEANUP_FAILED";
  message: string;
};

export class CleanupExpiredPendingAccountsUseCase {
  constructor(private readonly port: CleanupExpiredAccountsPort) {}

  async execute(): Promise<Result<CleanupExpiredAccountsResult, CleanupExpiredAccountsError>> {
    const cutoff = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000);
    try {
      const deletedCount = await this.port.deleteExpiredPendingAccounts(cutoff);
      return ok({ deletedCount });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return err({ type: "CLEANUP_FAILED" as const, message });
    }
  }
}
