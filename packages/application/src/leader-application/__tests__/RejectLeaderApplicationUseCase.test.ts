import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  RejectLeaderApplicationUseCase,
  REJECTION_COOLDOWN_MS,
  type RejectLeaderApplicationInput,
} from "../RejectLeaderApplicationUseCase";
import type {
  RejectLeaderApplicationPort,
  LeaderApplicationForReject,
} from "../ports/RejectLeaderApplicationPort";

// ==================== インメモリ実装 ====================

/**
 * テスト用のインメモリポート実装
 */
class InMemoryRejectLeaderApplicationPort implements RejectLeaderApplicationPort {
  /** 検索用の応募データ */
  applications: LeaderApplicationForReject[] = [];

  /** executeRejection で保存されたパラメータ */
  rejectionParams: Array<{
    applicationId: string;
    reviewerNote: string;
    reviewedAt: Date;
    outboxMessage: {
      id: string;
      type: string;
      payload: unknown;
    };
  }> = [];

  async findApplicationById(id: string): Promise<LeaderApplicationForReject | null> {
    return this.applications.find((a) => a.id === id) ?? null;
  }

  async executeRejection(params: {
    applicationId: string;
    reviewerNote: string;
    reviewedAt: Date;
    outboxMessage: {
      id: string;
      type: string;
      payload: unknown;
    };
  }): Promise<void> {
    this.rejectionParams.push(params);
  }
}

// ==================== テストデータ ====================

const VALID_APP_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_ACCOUNT_ID = "660e8400-e29b-41d4-a716-446655440000";

/**
 * PENDING 状態のテスト用応募データを生成する
 */
function pendingApplication(
  overrides?: Partial<LeaderApplicationForReject>
): LeaderApplicationForReject {
  return {
    id: VALID_APP_ID,
    accountId: VALID_ACCOUNT_ID,
    status: "PENDING",
    reviewedAt: null,
    ...overrides,
  };
}

/**
 * 有効な入力データを生成する
 */
function validInput(
  overrides?: Partial<RejectLeaderApplicationInput>
): RejectLeaderApplicationInput {
  return {
    applicationId: VALID_APP_ID,
    reviewerNote: "提出された企画書の内容が不十分です。再度ご検討ください。",
    ...overrides,
  };
}

// ==================== テスト ====================

describe("RejectLeaderApplicationUseCase", () => {
  let port: InMemoryRejectLeaderApplicationPort;
  let useCase: RejectLeaderApplicationUseCase;

  beforeEach(() => {
    port = new InMemoryRejectLeaderApplicationPort();
    useCase = new RejectLeaderApplicationUseCase(port);
  });

  // ---- ハッピーパス ----

  it("PENDING 応募を却下すると applicationId が返り、却下処理が実行される", async () => {
    port.applications.push(pendingApplication());

    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.applicationId).toBe(VALID_APP_ID);

    // executeRejection が呼ばれたことを確認
    expect(port.rejectionParams).toHaveLength(1);
    const params = port.rejectionParams[0];
    expect(params.applicationId).toBe(VALID_APP_ID);
    expect(params.reviewerNote).toBe(
      "提出された企画書の内容が不十分です。再度ご検討ください。"
    );
    expect(params.reviewedAt).toBeInstanceOf(Date);
  });

  it("Outbox メッセージの type が rejected.notify_applicant である", async () => {
    port.applications.push(pendingApplication());

    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const params = port.rejectionParams[0];
    expect(params.outboxMessage.type).toBe("rejected.notify_applicant");
  });

  it("Outbox メッセージの payload に applicationId, accountId, reviewerNote が含まれる", async () => {
    port.applications.push(pendingApplication());

    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const payload = port.rejectionParams[0].outboxMessage.payload as {
      applicationId: string;
      accountId: string;
      reviewerNote: string;
    };
    expect(payload.applicationId).toBe(VALID_APP_ID);
    expect(payload.accountId).toBe(VALID_ACCOUNT_ID);
    expect(payload.reviewerNote).toBe(
      "提出された企画書の内容が不十分です。再度ご検討ください。"
    );
  });

  it("Outbox メッセージの id が UUID v4 形式である", async () => {
    port.applications.push(pendingApplication());

    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(port.rejectionParams[0].outboxMessage.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  // ---- APPLICATION_NOT_FOUND ----

  it("存在しない応募 ID で実行すると APPLICATION_NOT_FOUND エラー", async () => {
    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("APPLICATION_NOT_FOUND");
  });

  // ---- NOT_PENDING ----

  it("APPROVED 状態の応募を却下しようとすると NOT_PENDING エラー", async () => {
    port.applications.push(pendingApplication({ status: "APPROVED" }));

    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("NOT_PENDING");
    if (result.error.type !== "NOT_PENDING") return;
    expect(result.error.currentStatus).toBe("APPROVED");
  });

  it("REJECTED 状態の応募を却下しようとすると NOT_PENDING エラー", async () => {
    port.applications.push(
      pendingApplication({ status: "REJECTED", reviewedAt: new Date() })
    );

    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("NOT_PENDING");
    if (result.error.type !== "NOT_PENDING") return;
    expect(result.error.currentStatus).toBe("REJECTED");
  });

  // ---- VALIDATION_ERROR ----

  it("reviewerNote が空文字の場合は VALIDATION_ERROR", async () => {
    port.applications.push(pendingApplication());

    const result = await useCase.execute(validInput({ reviewerNote: "" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
    if (result.error.type !== "VALIDATION_ERROR") return;
    expect(result.error.issues[0].path).toBe("reviewerNote");
  });

  it("reviewerNote が空白のみの場合は VALIDATION_ERROR", async () => {
    port.applications.push(pendingApplication());

    const result = await useCase.execute(validInput({ reviewerNote: "   " }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
    if (result.error.type !== "VALIDATION_ERROR") return;
    expect(result.error.issues[0].path).toBe("reviewerNote");
  });

  it("reviewerNote が 2000 文字超の場合は VALIDATION_ERROR", async () => {
    port.applications.push(pendingApplication());

    const longNote = "あ".repeat(2001);
    const result = await useCase.execute(validInput({ reviewerNote: longNote }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
    if (result.error.type !== "VALIDATION_ERROR") return;
    expect(result.error.issues[0].path).toBe("reviewerNote");
  });

  // ---- クールダウン定数 ----

  it("REJECTION_COOLDOWN_MS が 72 時間（259200000 ミリ秒）である", () => {
    expect(REJECTION_COOLDOWN_MS).toBe(72 * 60 * 60 * 1000);
  });
});
