import { type Result, err, ok, AccountId, SupportRecruitmentId } from "@physifun/domain";
import { findOwnedRecruitment } from "./findOwnedRecruitment";
import type { DeleteRecruitmentPort } from "./ports/DeleteRecruitmentPort";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface DeleteRecruitmentOutput {
  readonly recruitmentId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type DeleteRecruitmentError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_RECRUITMENT_ID" }
  | { readonly type: "RECRUITMENT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface DeleteRecruitmentInput {
  readonly accountId: string;
  readonly recruitmentId: string;
}

// ==================== ユースケース ====================

/**
 * サポート募集を削除するユースケース（日程も一緒に消える）
 *
 * 処理フロー:
 * 1. AccountId / SupportRecruitmentId VO 生成（入力バリデーション）
 * 2. 募集の存在チェック + オーナー権限チェック
 * 3. 削除
 */
export class DeleteRecruitmentUseCase {
  constructor(private readonly port: DeleteRecruitmentPort) {}

  async execute(
    input: DeleteRecruitmentInput
  ): Promise<Result<DeleteRecruitmentOutput, DeleteRecruitmentError>> {
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

    // 3. 削除（日程は DB の Cascade で消える）
    await this.port.delete(ownedResult.value.id);

    return ok({ recruitmentId: ownedResult.value.id.toString() });
  }
}
