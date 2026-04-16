import {
  type Result,
  err,
  ok,
  AccountId,
  ProjectId,
  type ProjectStateError,
} from "@physifun/domain";
import type { UnpublishProjectPort } from "./ports/UnpublishProjectPort";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface UnpublishProjectOutput {
  readonly projectId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type UnpublishProjectError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_PROJECT_ID" }
  | { readonly type: "PROJECT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" }
  | { readonly type: "DOMAIN_ERROR"; readonly domainError: ProjectStateError };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface UnpublishProjectInput {
  readonly accountId: string;
  readonly projectId: string;
}

// ==================== ユースケース ====================

/**
 * リーダー自主非公開化ユースケース: PUBLISHED → DRAFT
 *
 * 処理フロー:
 * 1. AccountId / ProjectId VO 生成（入力バリデーション）
 * 2. プロジェクトの存在チェック
 * 3. オーナー権限チェック
 * 4. project.unpublishSelf()（ステータス遷移）
 * 5. 永続化
 */
export class UnpublishProjectUseCase {
  constructor(private readonly port: UnpublishProjectPort) {}

  async execute(
    input: UnpublishProjectInput
  ): Promise<Result<UnpublishProjectOutput, UnpublishProjectError>> {
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

    // 4. 非公開化（ドメインロジック）
    const unpublishResult = project.unpublishSelf();
    if (!unpublishResult.ok) {
      return err({ type: "DOMAIN_ERROR", domainError: unpublishResult.error });
    }

    // 5. 永続化
    await this.port.saveProject(project);

    return ok({ projectId: project.id.toString() });
  }
}
