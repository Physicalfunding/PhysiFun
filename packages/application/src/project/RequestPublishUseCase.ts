import {
  type Result,
  err,
  ok,
  AccountId,
  ProjectId,
  type ProjectStateError,
  type Project,
} from "@physifun/domain";

// ==================== ポートインターフェース ====================

/**
 * RequestPublishUseCase のポートインターフェース
 *
 * インフラ層で実装する。
 */
export interface RequestPublishPort {
  /** プロジェクトID で Project 集約を取得する */
  findProjectById(projectId: string): Promise<Project | null>;

  /** Project 集約を永続化する */
  saveProject(project: Project): Promise<void>;
}

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

// ==================== ユースケース ====================

/**
 * 公開申請ユースケース: DRAFT → PENDING_REVIEW
 *
 * 処理フロー:
 * 1. AccountId / ProjectId VO 生成（入力バリデーション）
 * 2. プロジェクトの存在チェック
 * 3. オーナー権限チェック
 * 4. project.requestPublish()（必須項目チェック + ステータス遷移）
 * 5. 永続化
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

    // 5. 永続化
    await this.port.saveProject(project);

    return ok({ projectId: project.id.toString() });
  }
}
