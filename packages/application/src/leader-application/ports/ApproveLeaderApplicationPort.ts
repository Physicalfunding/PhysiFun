/**
 * ApproveLeaderApplicationUseCase が依存するポートインターフェース
 *
 * アプリケーション層は Prisma に直接依存せず、このポートを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

import type { LeaderApplication } from "@physifun/domain";
import type { AccountRole } from "../../shared/AccountRole";
import type { AdminReviewer } from "../../shared/AdminReviewer";

/**
 * 承認対象のアカウント情報
 *
 * 応募者のアカウント検索に使用する（reviewer は AdminAccount として別メソッドで取得する）。
 */
export interface AccountForApproval {
  readonly id: string;
  readonly status: "PENDING_EMAIL_CONFIRMATION" | "ACTIVE" | "SUSPENDED";
  readonly roles: readonly AccountRole[];
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
   * アカウント ID で応募者のアカウントを検索する。
   * 応募者のアカウント存在確認および LEADER ロール重複チェックに使用する。
   */
  findAccountById(accountId: string): Promise<AccountForApproval | null>;

  /**
   * AdminAccount ID で reviewer を検索する。
   *
   * インフラ側で status !== "ACTIVE" は null にマップされるため、
   * UseCase は null を「見つからない or 無効化済み」として扱えばよい。
   */
  findAdminReviewerById(id: string): Promise<AdminReviewer | null>;

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
