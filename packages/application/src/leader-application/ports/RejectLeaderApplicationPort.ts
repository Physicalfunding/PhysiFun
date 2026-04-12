/**
 * RejectLeaderApplicationUseCase が依存するポートインターフェース
 *
 * アプリケーション層は Prisma に直接依存せず、このポートを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

/**
 * 却下処理で取得するリーダー応募の最小行データ
 */
export interface LeaderApplicationForReject {
  readonly id: string;
  readonly accountId: string;
  readonly status: string;
  readonly reviewedAt: Date | null;
}

/**
 * RejectLeaderApplication ユースケースのポート
 *
 * トランザクション境界を含むすべての永続化操作をカプセル化する。
 * インフラ層が Prisma トランザクション等で実装する。
 */
export interface RejectLeaderApplicationPort {
  /**
   * 応募 ID でリーダー応募を検索する。
   * トランザクション外で呼ばれる。
   */
  findApplicationById(id: string): Promise<LeaderApplicationForReject | null>;

  /**
   * 指定アカウントの最新の却下済み応募を取得する。
   * クールダウンチェック用（再申請時に利用）。
   */
  findLatestRejectedByAccountId(accountId: string): Promise<{ rejectedAt: Date } | null>;

  /**
   * 却下処理 + Outbox メッセージ作成を 1 つのトランザクションで実行する。
   */
  executeRejection(params: {
    applicationId: string;
    reviewerNote: string;
    reviewedAt: Date;
    outboxMessage: {
      id: string;
      type: string;
      payload: unknown;
    };
  }): Promise<void>;
}
