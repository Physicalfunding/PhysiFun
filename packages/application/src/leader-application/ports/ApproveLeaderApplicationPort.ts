/**
 * ApproveLeaderApplicationUseCase が依存するポートインターフェース
 *
 * アプリケーション層は Prisma に直接依存せず、このポートを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

import type { LeaderApplication, LeaderApplicationStatus } from "@physifun/domain";

/**
 * アカウントのロール
 */
export type AccountRole = "SUPPORTER" | "LEADER" | "ADMIN";

/**
 * 承認対象のアカウント情報
 */
export interface AccountForApproval {
  readonly id: string;
  readonly status: "PENDING_EMAIL_CONFIRMATION" | "ACTIVE" | "SUSPENDED";
  readonly roles: AccountRole[];
  readonly email: string;
}

/**
 * ApproveLeaderApplication ユースケースのポート
 *
 * トランザクション境界を含むすべての永続化操作をカプセル化する。
 * インフラ層が Prisma トランザクション等で実装する。
 */
export interface ApproveLeaderApplicationPort {
  /**
   * 応募 ID でリーダー応募を検索する。
   */
  findApplicationById(id: string): Promise<LeaderApplication | null>;

  /**
   * アカウント ID でアカウントを検索する。
   */
  findAccountById(accountId: string): Promise<AccountForApproval | null>;

  /**
   * 承認処理をトランザクションで実行する。
   *
   * - LeaderApplication.status を APPROVED に更新
   * - Account.roles に LEADER を追加
   * - OutboxMessage を作成
   */
  executeApproval(params: {
    application: LeaderApplication;
    accountId: string;
    newRoles: AccountRole[];
    reviewedAt: Date;
    outboxMessage: {
      id: string;
      type: string;
      payload: unknown;
    };
  }): Promise<void>;
}
