import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  ApproveLeaderApplicationUseCase,
  type ApproveLeaderApplicationError,
} from "../ApproveLeaderApplicationUseCase";
import type {
  ApproveLeaderApplicationPort,
  LeaderApplicationRow,
  AccountForApproval,
} from "../ports/ApproveLeaderApplicationPort";

// ==================== インメモリ実装 ====================

/**
 * テスト用のインメモリポート実装
 */
class InMemoryApproveLeaderApplicationPort implements ApproveLeaderApplicationPort {
  /** 保存済みリーダー応募 */
  applications: LeaderApplicationRow[] = [];

  /** 保存済みアカウント */
  accounts: AccountForApproval[] = [];

  /** executeApproval で渡されたパラメータを記録 */
  approvalParams: Parameters<ApproveLeaderApplicationPort["executeApproval"]>[0][] = [];

  async findApplicationById(id: string): Promise<LeaderApplicationRow | null> {
    return this.applications.find((a) => a.id === id) ?? null;
  }

  async findAccountById(accountId: string): Promise<AccountForApproval | null> {
    return this.accounts.find((a) => a.id === accountId) ?? null;
  }

  async executeApproval(
    params: Parameters<ApproveLeaderApplicationPort["executeApproval"]>[0]
  ): Promise<void> {
    this.approvalParams.push(params);
  }
}

// ==================== テストデータ ====================

/** PENDING 状態のリーダー応募 */
function pendingApplication(overrides?: Partial<LeaderApplicationRow>): LeaderApplicationRow {
  return {
    id: "app-001",
    accountId: "account-001",
    status: "PENDING",
    email: "leader@example.com",
    ...overrides,
  };
}

/** SUPPORTER ロールのみのアカウント */
function supporterAccount(overrides?: Partial<AccountForApproval>): AccountForApproval {
  return {
    id: "account-001",
    status: "PENDING_EMAIL_CONFIRMATION",
    roles: ["SUPPORTER"],
    ...overrides,
  };
}

// ==================== テスト ====================

describe("ApproveLeaderApplicationUseCase", () => {
  let port: InMemoryApproveLeaderApplicationPort;
  let useCase: ApproveLeaderApplicationUseCase;

  beforeEach(() => {
    port = new InMemoryApproveLeaderApplicationPort();
    useCase = new ApproveLeaderApplicationUseCase(port);
  });

  // ---- ハッピーパス ----

  it("PENDING 応募を承認すると applicationId と accountId が返る", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    const result = await useCase.execute({ applicationId: "app-001" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.applicationId).toBe("app-001");
    expect(result.value.accountId).toBe("account-001");
  });

  it("executeApproval が正しいパラメータで呼ばれる", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: "app-001" });

    expect(port.approvalParams).toHaveLength(1);
    const params = port.approvalParams[0];
    expect(params.applicationId).toBe("app-001");
    expect(params.accountId).toBe("account-001");
    expect(params.newRoles).toEqual(["SUPPORTER", "LEADER"]);
    expect(params.reviewedAt).toBeInstanceOf(Date);
  });

  it("Account.roles に LEADER が追加される（既存ロール維持）", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ roles: ["SUPPORTER"] }));

    await useCase.execute({ applicationId: "app-001" });

    const params = port.approvalParams[0];
    expect(params.newRoles).toEqual(["SUPPORTER", "LEADER"]);
  });

  it("PENDING_EMAIL_CONFIRMATION のアカウントでも承認可能", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ status: "PENDING_EMAIL_CONFIRMATION" }));

    const result = await useCase.execute({ applicationId: "app-001" });

    expect(result.ok).toBe(true);
  });

  it("ACTIVE のアカウントでも承認可能", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ status: "ACTIVE" }));

    const result = await useCase.execute({ applicationId: "app-001" });

    expect(result.ok).toBe(true);
  });

  // ---- Outbox メッセージ ----

  it("Outbox メッセージの type が approved.notify_applicant", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: "app-001" });

    const outbox = port.approvalParams[0].outboxMessage;
    expect(outbox.type).toBe("approved.notify_applicant");
  });

  it("Outbox メッセージの payload に applicationId, accountId, email が含まれる", async () => {
    port.applications.push(pendingApplication({ email: "leader@example.com" }));
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: "app-001" });

    const payload = port.approvalParams[0].outboxMessage.payload as {
      applicationId: string;
      accountId: string;
      email: string;
    };
    expect(payload.applicationId).toBe("app-001");
    expect(payload.accountId).toBe("account-001");
    expect(payload.email).toBe("leader@example.com");
  });

  it("Outbox メッセージの id が UUID 形式", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: "app-001" });

    const outbox = port.approvalParams[0].outboxMessage;
    expect(outbox.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  // ---- エラーケース ----

  it("存在しない応募 ID で APPLICATION_NOT_FOUND", async () => {
    const result = await useCase.execute({ applicationId: "non-existent" });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("APPLICATION_NOT_FOUND");
  });

  it("応募に紐づくアカウントが存在しない場合 ACCOUNT_NOT_FOUND", async () => {
    port.applications.push(pendingApplication());
    // アカウントは追加しない

    const result = await useCase.execute({ applicationId: "app-001" });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("ACCOUNT_NOT_FOUND");
  });

  it("APPROVED 状態の応募を承認しようとすると NOT_PENDING", async () => {
    port.applications.push(pendingApplication({ status: "APPROVED" }));
    port.accounts.push(supporterAccount());

    const result = await useCase.execute({ applicationId: "app-001" });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("NOT_PENDING");
  });

  it("REJECTED 状態の応募を承認しようとすると NOT_PENDING", async () => {
    port.applications.push(pendingApplication({ status: "REJECTED" }));
    port.accounts.push(supporterAccount());

    const result = await useCase.execute({ applicationId: "app-001" });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("NOT_PENDING");
  });

  it("Account が既に LEADER ロールを持っている場合 ALREADY_LEADER", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ roles: ["SUPPORTER", "LEADER"] }));

    const result = await useCase.execute({ applicationId: "app-001" });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("ALREADY_LEADER");
  });

  it("NOT_PENDING の場合は executeApproval が呼ばれない", async () => {
    port.applications.push(pendingApplication({ status: "APPROVED" }));
    port.accounts.push(supporterAccount());

    await useCase.execute({ applicationId: "app-001" });

    expect(port.approvalParams).toHaveLength(0);
  });

  it("ALREADY_LEADER の場合は executeApproval が呼ばれない", async () => {
    port.applications.push(pendingApplication());
    port.accounts.push(supporterAccount({ roles: ["SUPPORTER", "LEADER"] }));

    await useCase.execute({ applicationId: "app-001" });

    expect(port.approvalParams).toHaveLength(0);
  });
});
