import { randomUUID } from "node:crypto";
import { type Result, err, ok } from "@physifun/domain";
import type { ApproveLeaderApplicationPort } from "./ports/ApproveLeaderApplicationPort";

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
  | { readonly type: "DOMAIN_ERROR"; readonly message: string };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface ApproveLeaderApplicationInput {
  readonly applicationId: string;
}

// ==================== ユースケース ====================

/**
 * リーダー応募を承認するユースケース
 *
 * 処理フロー（単一 DB トランザクション）:
 * 1. 前提条件チェック:
 *    - LeaderApplication.status === "PENDING"
 *    - 対応する Account レコードが存在する
 *    - Account.roles に "LEADER" が含まれていない
 * 2. LeaderApplication.status を APPROVED に更新
 * 3. Account.roles に LEADER を追加
 * 4. LeaderApplicationOutboxMessage に approved.notify_applicant タスクを書き込み
 * 5. トランザクションをコミット
 */
export class ApproveLeaderApplicationUseCase {
  constructor(private readonly port: ApproveLeaderApplicationPort) {}

  async execute(
    input: ApproveLeaderApplicationInput
  ): Promise<Result<ApproveLeaderApplicationOutput, ApproveLeaderApplicationError>> {
    // 1-a. 応募の存在チェック
    const application = await this.port.findApplicationById(input.applicationId);
    if (!application) {
      return err({ type: "APPLICATION_NOT_FOUND" });
    }

    // 1-b. PENDING 状態チェック（冪等性確保）
    if (application.status !== "PENDING") {
      return err({ type: "NOT_PENDING" });
    }

    // 1-c. アカウントの存在チェック
    const account = await this.port.findAccountById(application.accountId);
    if (!account) {
      return err({ type: "ACCOUNT_NOT_FOUND" });
    }

    // 1-d. LEADER ロール重複チェック
    if (account.roles.includes("LEADER")) {
      return err({ type: "ALREADY_LEADER" });
    }

    // 2-4. 承認処理をトランザクションで実行
    const now = new Date();
    const newRoles = [...account.roles, "LEADER"];
    const outboxMessageId = randomUUID();

    await this.port.executeApproval({
      applicationId: application.id,
      accountId: account.id,
      newRoles,
      reviewedAt: now,
      outboxMessage: {
        id: outboxMessageId,
        type: "approved.notify_applicant",
        payload: {
          applicationId: application.id,
          accountId: account.id,
          email: application.email,
        },
      },
    });

    return ok({
      applicationId: application.id,
      accountId: account.id,
    });
  }
}
