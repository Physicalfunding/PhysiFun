/**
 * ApproveLeaderApplicationUseCase が依存するポートインターフェース
 *
 * アプリケーション層は Prisma に直接依存せず、このポートを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

import type { LeaderApplication, Project } from "@physifun/domain";
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
   * - Account.roles に LEADER を追加（既に LEADER の場合 UseCase 側でスキップ判断、
   *   Port には常に既存ロールを含むスナップショットが渡される）
   * - 新規 Project（DRAFT）を 1 件作成（Issue #192 PR5）
   * - OutboxMessage を作成（payload には新規 projectId を含む）
   */
  executeApproval(params: {
    application: LeaderApplication;
    accountId: string;
    newRoles: AccountRole[];
    reviewedAt: Date;
    /**
     * 承認時に同時作成する初期 Project（DRAFT）。
     * Issue #192 PR5 で追加。LeaderApplication の応募内容から派生させた値を持つ。
     */
    project: Project;
    outboxMessage: {
      id: string;
      type: string;
      payload: unknown;
    };
  }): Promise<void>;
}
