/**
 * ApproveLeaderApplicationUseCase が依存するポートインターフェース
 *
 * アプリケーション層は Prisma に直接依存せず、このポートを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

import type { LeaderApplication } from "@physifun/domain";
import type { AccountRole } from "../../shared/AccountRole";

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
/**
 * reviewer (ADMIN) の最小限の情報
 */
export interface ReviewerAccount {
  readonly id: string;
  readonly roles: AccountRole[];
}

export interface ApproveLeaderApplicationPort {
  /**
   * 応募 ID でリーダー応募を検索する。
   */
  findApplicationById(id: string): Promise<LeaderApplication | null>;

  /**
   * アカウント ID でアカウントを検索する（応募者のアカウント）。
   */
  findAccountById(accountId: string): Promise<AccountForApproval | null>;

  /**
   * reviewer ID で ADMIN アカウントを検索する（二重防御用）。
   */
  findReviewerById(reviewerId: string): Promise<ReviewerAccount | null>;

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
