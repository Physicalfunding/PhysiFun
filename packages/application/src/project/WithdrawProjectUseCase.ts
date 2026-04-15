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
 * WithdrawProjectUseCase のポートインターフェース
 *
 * インフラ層で実装する。
 */
export interface WithdrawProjectPort {
  /** プロジェクトID で Project 集約を取得する */
  findProjectById(projectId: string): Promise<Project | null>;

  /** Project 集約を永続化する */
  saveProject(project: Project): Promise<void>;
}

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface WithdrawProjectOutput {
  readonly projectId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type WithdrawProjectError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_PROJECT_ID" }
  | { readonly type: "PROJECT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" }
  | { readonly type: "DOMAIN_ERROR"; readonly domainError: ProjectStateError };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface WithdrawProjectInput {
  readonly accountId: string;
  readonly projectId: string;
}

// ==================== ユースケース ====================

/**
 * 自主取下げユースケース: PENDING_REVIEW → DRAFT
 *
 * 処理フロー:
 * 1. AccountId / ProjectId VO 生成（入力バリデーション）
 * 2. プロジェクトの存在チェック
 * 3. オーナー権限チェック
 * 4. project.withdraw()（ステータス遷移）
 * 5. 永続化（ReviewFeedback なし — 自主取下げのため）
 */
export class WithdrawProjectUseCase {
  constructor(private readonly port: WithdrawProjectPort) {}

  async execute(
    input: WithdrawProjectInput
  ): Promise<Result<WithdrawProjectOutput, WithdrawProjectError>> {
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

    // 4. 取下げ（ドメインロジック）
    const withdrawResult = project.withdraw();
    if (!withdrawResult.ok) {
      return err({ type: "DOMAIN_ERROR", domainError: withdrawResult.error });
    }

    // 5. 永続化
    await this.port.saveProject(project);

    return ok({ projectId: project.id.toString() });
  }
}
