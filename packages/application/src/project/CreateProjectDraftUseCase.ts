import {
  type Result,
  err,
  ok,
  Project,
  AccountId,
  type ProjectUpdateError,
} from "@physifun/domain";
import type { CreateProjectDraftPort } from "./ports/CreateProjectDraftPort";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface CreateProjectDraftOutput {
  readonly projectId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type CreateProjectDraftError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "ACCOUNT_NOT_FOUND" }
  | { readonly type: "NOT_LEADER" }
  | { readonly type: "PROJECT_LIMIT_EXCEEDED"; readonly max: number }
  | { readonly type: "DOMAIN_ERROR"; readonly domainError: ProjectUpdateError };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface CreateProjectDraftInput {
  readonly accountId: string;
  readonly title: string;
}

// ==================== 定数 ====================

/**
 * リーダーあたりの最大プロジェクト数（全ステータス合計）
 *
 * NOTE: PUBLISHED 3件上限は RequestPublishUseCase が担う。
 */
export const MAX_PROJECTS_PER_LEADER = 10;

// ==================== ユースケース ====================

/**
 * DRAFT プロジェクトを新規作成するユースケース
 *
 * 処理フロー:
 * 1. AccountId VO 生成（入力バリデーション）
 * 2. アカウントの存在チェック
 * 3. LEADER ロールチェック
 * 4. Project.createDraft でドメインエンティティ生成
 * 5. 件数チェック + 永続化（アトミック）
 * 6. projectId を返却
 */
export class CreateProjectDraftUseCase {
  constructor(private readonly port: CreateProjectDraftPort) {}

  async execute(
    input: CreateProjectDraftInput
  ): Promise<Result<CreateProjectDraftOutput, CreateProjectDraftError>> {
    // 1. AccountId VO 生成（入力バリデーション）
    const accountIdResult = AccountId.from(input.accountId);
    if (!accountIdResult.ok) {
      return err({ type: "INVALID_ACCOUNT_ID" });
    }

    // 2. アカウントの存在チェック
    const account = await this.port.findAccountById(input.accountId);
    if (!account) {
      return err({ type: "ACCOUNT_NOT_FOUND" });
    }

    // 3. LEADER ロールチェック
    if (!account.roles.includes("LEADER")) {
      return err({ type: "NOT_LEADER" });
    }

    // 4. ドメインエンティティ生成
    const projectResult = Project.createDraft({
      ownerAccountId: accountIdResult.value,
      title: input.title,
    });
    if (!projectResult.ok) {
      return err({ type: "DOMAIN_ERROR", domainError: projectResult.error });
    }

    // 5. 件数チェック + 永続化（アトミック、TOCTOU 防止）
    const project = projectResult.value;
    try {
      await this.port.countAndSaveProject({
        project,
        accountId: input.accountId,
        maxCount: MAX_PROJECTS_PER_LEADER,
      });
    } catch (e) {
      if (e instanceof ProjectLimitExceededError) {
        return err({ type: "PROJECT_LIMIT_EXCEEDED", max: MAX_PROJECTS_PER_LEADER });
      }
      throw e;
    }

    // 6. 結果返却
    return ok({ projectId: project.id.toString() });
  }
}

/**
 * countAndSaveProject が上限超過時にスローするエラー
 */
export class ProjectLimitExceededError extends Error {
  constructor() {
    super("Project limit exceeded");
    this.name = "ProjectLimitExceededError";
  }
}
