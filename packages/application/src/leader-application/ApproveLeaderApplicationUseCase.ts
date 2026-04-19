import { randomUUID } from "node:crypto";
import { type Result, err, ok } from "@physifun/domain";
import type { ApproveLeaderApplicationPort } from "./ports/ApproveLeaderApplicationPort";
import type { AccountRole } from "../shared/AccountRole";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface ApproveLeaderApplicationOutput {
  readonly applicationId: string;
  readonly accountId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type ApproveLeaderApplicationError =
  | { readonly type: "APPLICATION_NOT_FOUND" }
  | { readonly type: "ACCOUNT_NOT_FOUND" }
  | { readonly type: "NOT_PENDING" }
  | { readonly type: "ALREADY_LEADER" }
  | { readonly type: "REVIEWER_NOT_FOUND" }
  | { readonly type: "REVIEWER_NOT_ADMIN" };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface ApproveLeaderApplicationInput {
  readonly applicationId: string;
  readonly reviewerId: string;
}

// ==================== ユースケース ====================

/**
 * リーダー応募を承認するユースケース
 *
 * 処理フロー（単一 DB トランザクション）:
 * 1. reviewer の ADMIN ロール検証（二重防御）
 * 2. 前提条件チェック:
 *    - LeaderApplication.status === "PENDING"
 *    - 対応する Account レコードが存在する
 *    - Account.roles に "LEADER" が含まれていない
 * 3. LeaderApplication.status を APPROVED に更新
 * 4. Account.roles に LEADER を追加
 * 5. LeaderApplicationOutboxMessage に approved.notify_applicant タスクを書き込み
 * 6. トランザクションをコミット
 */
export class ApproveLeaderApplicationUseCase {
  constructor(private readonly port: ApproveLeaderApplicationPort) {}

  async execute(
    input: ApproveLeaderApplicationInput
  ): Promise<Result<ApproveLeaderApplicationOutput, ApproveLeaderApplicationError>> {
    // 1. reviewer の ADMIN ロール検証（二重防御: Route 層 + UseCase 層）
    const reviewer = await this.port.findReviewerById(input.reviewerId);
    if (!reviewer) {
      return err({ type: "REVIEWER_NOT_FOUND" });
    }
    if (!reviewer.roles.includes("ADMIN")) {
      return err({ type: "REVIEWER_NOT_ADMIN" });
    }

    // 2-a. 応募の存在チェック
    const application = await this.port.findApplicationById(input.applicationId);
    if (!application) {
      return err({ type: "APPLICATION_NOT_FOUND" });
    }

    // 2-b. ドメインエンティティの approve() を呼んで PENDING 状態チェック
    const approveResult = application.approve();
    if (!approveResult.ok) {
      return err({ type: "NOT_PENDING" });
    }

    // 2-c. アカウントの存在チェック
    const account = await this.port.findAccountById(application.accountId.toString());
    if (!account) {
      return err({ type: "ACCOUNT_NOT_FOUND" });
    }

    // 2-d. LEADER ロール重複チェック
    if (account.roles.includes("LEADER")) {
      return err({ type: "ALREADY_LEADER" });
    }

    // 3-5. 承認処理をトランザクションで実行
    const now = new Date();
    const newRoles: AccountRole[] = [...account.roles, "LEADER"];
    const outboxMessageId = randomUUID();

    await this.port.executeApproval({
      application,
      accountId: account.id,
      newRoles,
      reviewedAt: now,
      outboxMessage: {
        id: outboxMessageId,
        type: "approved.notify_applicant",
        payload: {
          applicationId: application.id.toString(),
          accountId: account.id,
          email: account.email,
        },
      },
    });

    return ok({
      applicationId: application.id.toString(),
      accountId: account.id,
    });
  }
}
