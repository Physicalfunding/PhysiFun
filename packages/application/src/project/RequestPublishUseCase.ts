import { randomUUID } from "node:crypto";
import {
  type Result,
  err,
  ok,
  AccountId,
  ProjectId,
  type ProjectStateError,
} from "@physifun/domain";
import type { RequestPublishPort } from "./ports/RequestPublishPort";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface RequestPublishOutput {
  readonly projectId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type RequestPublishError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_PROJECT_ID" }
  | { readonly type: "PROJECT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" }
  | { readonly type: "DOMAIN_ERROR"; readonly domainError: ProjectStateError };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface RequestPublishInput {
  readonly accountId: string;
  readonly projectId: string;
}

// ==================== Outbox 定数 ====================

/**
 * 運営への公開申請通知タスク種別
 *
 * Outbox ワーカーが運営向けに「新しい公開申請が届いた」旨のメールを送信する。
 */
export const ADMIN_PUBLISH_REQUEST_NOTIFY_TYPE = "admin_publish_request.notify";

// ==================== ユースケース ====================

/**
 * 公開申請ユースケース: DRAFT → PENDING_REVIEW
 *
 * 処理フロー:
 * 1. AccountId / ProjectId VO 生成（入力バリデーション）
 * 2. プロジェクトの存在チェック
 * 3. オーナー権限チェック
 * 4. project.requestPublish()（必須項目チェック + ステータス遷移）
 * 5. Project.status 更新と ProjectOutboxMessage 書き込みを
 *    同一トランザクションで永続化（Outbox パターン）
 */
export class RequestPublishUseCase {
  constructor(private readonly port: RequestPublishPort) {}

  async execute(
    input: RequestPublishInput
  ): Promise<Result<RequestPublishOutput, RequestPublishError>> {
    // 1. AccountId / ProjectId VO 生成（入力バリデーション）
    const accountIdResult = AccountId.from(input.accountId);
    if (!accountIdResult.ok) {
      return err({ type: "INVALID_ACCOUNT_ID" });
    }

    const projectIdResult = ProjectId.from(input.projectId);
    if (!projectIdResult.ok) {
      return err({ type: "INVALID_PROJECT_ID" });
    }

    // 2. プロジェクトの存在チェック
    const project = await this.port.findProjectById(input.projectId);
    if (!project) {
      return err({ type: "PROJECT_NOT_FOUND" });
    }

    // 3. オーナー権限チェック
    if (!project.ownerAccountId.equals(accountIdResult.value)) {
      return err({ type: "NOT_OWNER" });
    }

    // 4. 公開申請（ドメインロジック）
    const publishResult = project.requestPublish();
    if (!publishResult.ok) {
      return err({ type: "DOMAIN_ERROR", domainError: publishResult.error });
    }

    // 5. トランザクション内で永続化 + Outbox 書き込み
    // project.requestPublish() 内で updatedAt が申請日時にセットされる
    const requestedAt = project.updatedAt;
    await this.port.executeInTransaction({
      project,
      outboxMessage: {
        id: randomUUID(),
        type: ADMIN_PUBLISH_REQUEST_NOTIFY_TYPE,
        payload: {
          projectId: project.id.toString(),
          projectTitle: project.title,
          leaderAccountId: project.ownerAccountId.toString(),
          requestedAt: requestedAt.toISOString(),
        },
      },
    });

    return ok({ projectId: project.id.toString() });
  }
}
