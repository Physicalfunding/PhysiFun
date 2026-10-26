import {
  type Result,
  err,
  ok,
  AccountId,
  ProjectId,
  RecruitmentType,
  SupportRecruitment,
  type SupportRecruitmentUpdateError,
} from "@physifun/domain";
import type { CreateRecruitmentPort } from "./ports/CreateRecruitmentPort";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface CreateRecruitmentOutput {
  readonly recruitmentId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type CreateRecruitmentError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_PROJECT_ID" }
  | { readonly type: "PROJECT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" }
  | { readonly type: "DOMAIN_ERROR"; readonly domainError: SupportRecruitmentUpdateError };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface CreateRecruitmentInput {
  readonly accountId: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
}

// ==================== ユースケース ====================

/**
 * プロジェクトにサポート募集を作成するユースケース（日程はまだ無い）
 *
 * - 募集の種類は `ACTIVITY` で固定（初回リリースはこれだけ。#291）
 * - プロジェクトの公開状態は問わない（公開中でも募集を足せる。`02_domain-model.md` §8.4）
 *
 * 処理フロー:
 * 1. AccountId / ProjectId VO 生成（入力バリデーション）
 * 2. プロジェクトの存在チェック + オーナー権限チェック
 * 3. SupportRecruitment.create でドメインエンティティ生成
 * 4. 永続化
 */
export class CreateRecruitmentUseCase {
  constructor(private readonly port: CreateRecruitmentPort) {}

  async execute(
    input: CreateRecruitmentInput
  ): Promise<Result<CreateRecruitmentOutput, CreateRecruitmentError>> {
    // 1. AccountId / ProjectId VO 生成（入力バリデーション）
    const accountIdResult = AccountId.from(input.accountId);
    if (!accountIdResult.ok) {
      return err({ type: "INVALID_ACCOUNT_ID" });
    }

    const projectIdResult = ProjectId.from(input.projectId);
    if (!projectIdResult.ok) {
      return err({ type: "INVALID_PROJECT_ID" });
    }

    // 2. プロジェクトの存在チェック + オーナー権限チェック
    const ownerAccountId = await this.port.findProjectOwner(projectIdResult.value);
    if (!ownerAccountId) {
      return err({ type: "PROJECT_NOT_FOUND" });
    }
    if (!ownerAccountId.equals(accountIdResult.value)) {
      return err({ type: "NOT_OWNER" });
    }

    // 3. ドメインエンティティ生成
    const recruitmentResult = SupportRecruitment.create({
      projectId: projectIdResult.value,
      type: RecruitmentType.ACTIVITY,
      title: input.title,
      description: input.description,
    });
    if (!recruitmentResult.ok) {
      return err({ type: "DOMAIN_ERROR", domainError: recruitmentResult.error });
    }

    // 4. 永続化
    const recruitment = recruitmentResult.value;
    await this.port.create(recruitment);

    return ok({ recruitmentId: recruitment.id.toString() });
  }
}
