/**
 * ApproveLeaderApplicationUseCase が依存するポートインターフェース
 *
 * アプリケーション層は Prisma に直接依存せず、このポートを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

/**
 * 承認フローで扱うリーダー応募のステータス
 */
export type LeaderApplicationStatusForApproval = "PENDING" | "APPROVED" | "REJECTED";

/**
 * 応募の永続化行（findApplicationById 用）
 */
export interface LeaderApplicationRow {
  readonly id: string;
  readonly accountId: string;
  readonly status: LeaderApplicationStatusForApproval;
  readonly email: string;
}

/**
 * アカウントのロール
 */
export type AccountRole = "SUPPORTER" | "LEADER" | "ADMIN";

/**
 * 承認対象のアカウント情報
 */
export interface AccountForApproval {
  readonly id: string;
  readonly status: string;
  readonly roles: AccountRole[];
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
  findApplicationById(id: string): Promise<LeaderApplicationRow | null>;

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
    applicationId: string;
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
