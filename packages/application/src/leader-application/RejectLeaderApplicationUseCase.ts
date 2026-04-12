import { randomUUID } from "node:crypto";
import {
  type Result,
  err,
  ok,
  LEADER_APPLICATION_REVIEWER_NOTE_MAX_LENGTH,
} from "@physifun/domain";
import type { RejectLeaderApplicationPort } from "./ports/RejectLeaderApplicationPort";

// ==================== 定数 ====================

/**
 * 却下後の再申請クールダウン期間（72 時間）
 *
 * 却下されたアカウントが再度リーダー応募するまでの最低待機時間。
 * チェック自体は SubmitLeaderApplicationUseCase の責務だが、
 * 定数はここで一元管理する。
 */
export const REJECTION_COOLDOWN_MS = 72 * 60 * 60 * 1000;

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
 * 1. 入力バリデーション（applicationId / reviewerNote）
 * 2. 応募の存在確認
 * 3. PENDING 状態チェック（冪等性確保）
 * 4. reviewerNote バリデーション（ドメイン定数を使用）
 * 5. Outbox メッセージ作成 + 却下処理をトランザクションで実行
 */
export class RejectLeaderApplicationUseCase {
  constructor(private readonly port: RejectLeaderApplicationPort) {}

  async execute(
    input: RejectLeaderApplicationInput
  ): Promise<Result<RejectLeaderApplicationOutput, RejectLeaderApplicationError>> {
    // 1. 入力バリデーション
    const { applicationId, reviewerNote } = input;

    if (!applicationId || applicationId.trim().length === 0) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [{ path: "applicationId", message: "応募 ID は必須です" }],
      });
    }

    if (!reviewerNote || reviewerNote.trim().length === 0) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [{ path: "reviewerNote", message: "却下理由は必須です" }],
      });
    }

    const trimmedNote = reviewerNote.trim();

    if (trimmedNote.length > LEADER_APPLICATION_REVIEWER_NOTE_MAX_LENGTH) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [
          {
            path: "reviewerNote",
            message: `却下理由は ${LEADER_APPLICATION_REVIEWER_NOTE_MAX_LENGTH} 文字以内です`,
          },
        ],
      });
    }

    // 2. 応募の存在確認
    const application = await this.port.findApplicationById(applicationId);
    if (!application) {
      return err({ type: "APPLICATION_NOT_FOUND" });
    }

    // 3. PENDING 状態チェック（冪等性確保）
    if (application.status !== "PENDING") {
      return err({
        type: "NOT_PENDING",
        currentStatus: application.status,
      });
    }

    // 4. 却下実行（Outbox メッセージ作成 + 却下処理をトランザクションで実行）
    const now = new Date();
    const outboxMessageId = randomUUID();

    await this.port.executeRejection({
      applicationId,
      reviewerNote: trimmedNote,
      reviewedAt: now,
      outboxMessage: {
        id: outboxMessageId,
        type: "rejected.notify_applicant",
        payload: {
          applicationId,
          accountId: application.accountId,
          reviewerNote: trimmedNote,
        },
      },
    });

    return ok({ applicationId });
  }
}
