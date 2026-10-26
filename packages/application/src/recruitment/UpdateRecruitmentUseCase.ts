import {
  type Result,
  err,
  ok,
  AccountId,
  SupportRecruitmentId,
  type SupportRecruitmentUpdateError,
} from "@physifun/domain";
import { findOwnedRecruitment } from "./findOwnedRecruitment";
import type { UpdateRecruitmentPort } from "./ports/UpdateRecruitmentPort";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface UpdateRecruitmentOutput {
  readonly recruitmentId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type UpdateRecruitmentError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_RECRUITMENT_ID" }
  | { readonly type: "RECRUITMENT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" }
  | { readonly type: "DOMAIN_ERROR"; readonly domainError: SupportRecruitmentUpdateError };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO（指定した項目だけ変える）
 */
export interface UpdateRecruitmentInput {
  readonly accountId: string;
  readonly recruitmentId: string;
  readonly title?: string;
  readonly description?: string;
}

// ==================== ユースケース ====================

/**
 * サポート募集のタイトル・説明を更新するユースケース
 *
 * 処理フロー:
 * 1. AccountId / SupportRecruitmentId VO 生成（入力バリデーション）
 * 2. 募集の存在チェック + オーナー権限チェック
 * 3. recruitment.update()
 * 4. 永続化（募集自身の項目だけ。日程は書かない）
 */
export class UpdateRecruitmentUseCase {
  constructor(private readonly port: UpdateRecruitmentPort) {}

  async execute(
    input: UpdateRecruitmentInput
  ): Promise<Result<UpdateRecruitmentOutput, UpdateRecruitmentError>> {
    // 1. AccountId / SupportRecruitmentId VO 生成（入力バリデーション）
    const accountIdResult = AccountId.from(input.accountId);
    if (!accountIdResult.ok) {
      return err({ type: "INVALID_ACCOUNT_ID" });
    }

    const recruitmentIdResult = SupportRecruitmentId.from(input.recruitmentId);
    if (!recruitmentIdResult.ok) {
      return err({ type: "INVALID_RECRUITMENT_ID" });
    }

    // 2. 募集の存在チェック + オーナー権限チェック
    const ownedResult = await findOwnedRecruitment(
      this.port,
      recruitmentIdResult.value,
      accountIdResult.value
    );
    if (!ownedResult.ok) {
      return err(ownedResult.error);
    }
    const recruitment = ownedResult.value;

    // 3. ドメインロジック
    const updateResult = recruitment.update({
      title: input.title,
      description: input.description,
    });
    if (!updateResult.ok) {
      return err({ type: "DOMAIN_ERROR", domainError: updateResult.error });
    }

    // 4. 永続化
    await this.port.update(recruitment);

    return ok({ recruitmentId: recruitment.id.toString() });
  }
}
