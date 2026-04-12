import { randomUUID } from "node:crypto";
import {
  type Result,
  err,
  ok,
  AccountId,
  LeaderApplication,
  LeaderApplicationId,
  LeaderApplicationStatus,
  type LeaderApplicationStateError,
  ProjectDraft,
  ProjectLocation,
  SnsLinks,
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
  | { readonly type: "NOT_PENDING"; readonly currentStatus: string }
  | {
      readonly type: "DOMAIN_ERROR";
      readonly domainError: LeaderApplicationStateError;
    };

// ==================== ダミー ProjectDraft ====================

/**
 * reject() 実行に必要な reconstruct 用ダミー ProjectDraft を生成する。
 *
 * reject() メソッドは projectDraft フィールドを一切参照しないため、
 * Port から projectDraft を取得する必要はない。型制約を満たすためだけに使用する。
 */
function createDummyProjectDraft(): ProjectDraft {
  const locationResult = ProjectLocation.create({
    prefectureCode: "01",
    municipality: null,
  });
  if (!locationResult.ok) throw new Error("ダミー ProjectLocation の生成に失敗");

  const snsLinksResult = SnsLinks.create({
    x: null,
    instagram: null,
    facebook: null,
    website: null,
  });
  if (!snsLinksResult.ok) throw new Error("ダミー SnsLinks の生成に失敗");

  const draftResult = ProjectDraft.create({
    projectTitle: "dummy",
    projectSummary: "dummy",
    projectStory: "dummy",
    projectCategory: "KOMINKA",
    location: locationResult.value,
    plannedActivities: "dummy",
    snsLinks: snsLinksResult.value,
  });
  if (!draftResult.ok) throw new Error("ダミー ProjectDraft の生成に失敗");

  return draftResult.value;
}

// ==================== ユースケース ====================

/**
 * リーダー応募を却下するユースケース
 *
 * 1. 入力バリデーション（applicationId / reviewerNote）
 * 2. 応募の存在確認
 * 3. PENDING 状態チェック（冪等性確保）
 * 4. ドメインエンティティ復元 → reject() 呼び出し
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

    if (reviewerNote.trim().length > 2000) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [
          { path: "reviewerNote", message: "却下理由は 2000 文字以内です" },
        ],
      });
    }

    // 2. 応募の存在確認
    const applicationRow = await this.port.findApplicationById(applicationId);
    if (!applicationRow) {
      return err({ type: "APPLICATION_NOT_FOUND" });
    }

    // 3. PENDING 状態チェック（冪等性確保）
    if (applicationRow.status !== LeaderApplicationStatus.PENDING) {
      return err({
        type: "NOT_PENDING",
        currentStatus: applicationRow.status,
      });
    }

    // 4. ドメインエンティティ復元 → reject() 呼び出し
    //    Port から取得するのは最小限の行データなので、reconstruct に必要な
    //    projectDraft 等はダミーで補完する（reject() は projectDraft に触れない）
    const idResult = LeaderApplicationId.from(applicationRow.id);
    if (!idResult.ok) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [{ path: "applicationId", message: "無効な応募 ID 形式です" }],
      });
    }

    const accountIdResult = AccountId.from(applicationRow.accountId);
    if (!accountIdResult.ok) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [{ path: "accountId", message: "無効なアカウント ID 形式です" }],
      });
    }

    const entity = LeaderApplication.reconstruct({
      id: idResult.value,
      accountId: accountIdResult.value,
      status: LeaderApplicationStatus.PENDING,
      projectDraft: createDummyProjectDraft(),
      submittedAt: new Date(),
      reviewedAt: null,
      reviewerNote: null,
    });

    const now = new Date();
    const rejectResult = entity.reject({
      reviewerNote,
      reviewedAt: now,
    });

    if (!rejectResult.ok) {
      // ドメインエラーをラップして返す
      return err({
        type: "DOMAIN_ERROR",
        domainError: rejectResult.error,
      });
    }

    // 5. Outbox メッセージ作成 + 却下処理をトランザクションで実行
    const outboxMessageId = randomUUID();

    await this.port.executeRejection({
      applicationId,
      reviewerNote: entity.reviewerNote!,
      reviewedAt: entity.reviewedAt!,
      outboxMessage: {
        id: outboxMessageId,
        type: "rejected.notify_applicant",
        payload: {
          applicationId,
          accountId: applicationRow.accountId,
          reviewerNote: entity.reviewerNote!,
        },
      },
    });

    return ok({ applicationId });
  }
}
