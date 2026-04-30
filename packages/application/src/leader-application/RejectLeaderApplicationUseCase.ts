import { randomUUID } from "node:crypto";
import { type Result, err, ok } from "@physifun/domain";
import type { RejectLeaderApplicationPort } from "./ports/RejectLeaderApplicationPort";

// ==================== 定数 ====================

/**
 * 却下後の再申請クールダウン期間（72 時間）
 *
 * 却下されたアカウントが再度リーダー応募するまでの最低待機時間。
 * チェック自体は SubmitLeaderApplicationUseCase の責務だが、
 * 定数はここで一元管理する。
 */
// TODO: #XX クールダウン定数はドメイン層に移動する
export const REJECTION_COOLDOWN_MS = 72 * 60 * 60 * 1000;

/**
 * リーダー応募却下時に書き込まれる LeaderApplicationOutboxMessage の type 定数。
 * 対応 processor: `LeaderApplicationRejectedNotifyProcessor` (#187)
 */
export const LEADER_APPLICATION_REJECTED_NOTIFY_TYPE = "rejected.notify_applicant" as const;

// ==================== 入力型 ====================

/**
 * ユースケースの入力 DTO
 */
export interface RejectLeaderApplicationInput {
  readonly applicationId: string;
  readonly reviewerNote: string;
}

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface RejectLeaderApplicationOutput {
  readonly applicationId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type RejectLeaderApplicationError =
  | {
      readonly type: "VALIDATION_ERROR";
      readonly issues: Array<{ path: string; message: string }>;
    }
  | { readonly type: "APPLICATION_NOT_FOUND" }
  | { readonly type: "NOT_PENDING"; readonly currentStatus: string };

// ==================== ユースケース ====================

/**
 * リーダー応募を却下するユースケース
 *
 * 1. 入力バリデーション（applicationId）
 * 2. 応募の存在確認
 * 3. ドメインエンティティの reject() で状態遷移 + バリデーション
 * 4. Outbox メッセージ作成 + 却下処理をトランザクションで実行
 */
export class RejectLeaderApplicationUseCase {
  constructor(private readonly port: RejectLeaderApplicationPort) {}

  async execute(
    input: RejectLeaderApplicationInput
  ): Promise<Result<RejectLeaderApplicationOutput, RejectLeaderApplicationError>> {
    // 1. 入力バリデーション（applicationId はユースケース層の入力なのでここでチェック）
    const { applicationId } = input;

    if (!applicationId || applicationId.trim().length === 0) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [{ path: "applicationId", message: "応募 ID は必須です" }],
      });
    }

    // 2. 応募の存在確認
    const application = await this.port.findApplicationById(applicationId);
    if (!application) {
      return err({ type: "APPLICATION_NOT_FOUND" });
    }

    // 3. ドメインエンティティの reject() で状態遷移 + バリデーション
    const rejectResult = application.reject({ reviewerNote: input.reviewerNote });
    if (!rejectResult.ok) {
      const domainError = rejectResult.error;
      switch (domainError.type) {
        case "CANNOT_REJECT_NON_PENDING":
          return err({
            type: "NOT_PENDING",
            currentStatus: domainError.currentStatus,
          });
        case "REVIEWER_NOTE_REQUIRED":
          return err({
            type: "VALIDATION_ERROR",
            issues: [{ path: "reviewerNote", message: "却下理由は必須です" }],
          });
        case "REVIEWER_NOTE_TOO_LONG":
          return err({
            type: "VALIDATION_ERROR",
            issues: [
              {
                path: "reviewerNote",
                message: `却下理由は ${domainError.maxLength} 文字以内です`,
              },
            ],
          });
      }
    }

    // 4. 却下実行（Outbox メッセージ作成 + 却下処理をトランザクションで実行）
    const outboxMessageId = randomUUID();

    await this.port.executeRejectionInTransaction({
      application,
      outboxMessage: {
        id: outboxMessageId,
        type: LEADER_APPLICATION_REJECTED_NOTIFY_TYPE,
        payload: {
          applicationId: application.id.toString(),
          accountId: application.accountId.toString(),
          reviewerNote: application.reviewerNote,
        },
      },
    });

    return ok({ applicationId: application.id.toString() });
  }
}
