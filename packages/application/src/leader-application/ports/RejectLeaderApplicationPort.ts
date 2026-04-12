/**
 * RejectLeaderApplicationUseCase が依存するポートインターフェース
 *
 * アプリケーション層は Prisma に直接依存せず、このポートを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

import type { LeaderApplication } from "@physifun/domain";

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
  findApplicationById(id: string): Promise<LeaderApplication | null>;

  /**
   * 却下処理 + Outbox メッセージ作成を 1 つのトランザクションで実行する。
   */
  executeRejectionInTransaction(params: {
    application: LeaderApplication;
    outboxMessage: {
      id: string;
      type: string;
      payload: unknown;
    };
  }): Promise<void>;
}
