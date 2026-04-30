import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  SubmitLeaderApplicationUseCase,
  type SubmitLeaderApplicationInput,
} from "../SubmitLeaderApplicationUseCase";
import type {
  SubmitLeaderApplicationPort,
  AccountRow,
  CreateAccountParams,
  CreateLeaderApplicationParams,
  CreateOutboxMessageParams,
} from "../ports/SubmitLeaderApplicationPort";

// ==================== インメモリ実装 ====================

/**
 * テスト用のインメモリポート実装
 */
class InMemorySubmitLeaderApplicationPort implements SubmitLeaderApplicationPort {
  /** 保存済みアカウント（findByEmail 用） */
  accounts: AccountRow[] = [];

  /** トランザクション内で作成されたアカウント */
  createdAccounts: CreateAccountParams[] = [];

  /** トランザクション内で作成されたリーダー応募 */
  createdApplications: CreateLeaderApplicationParams[] = [];

  /** トランザクション内で作成された Outbox メッセージ */
  createdOutboxMessages: CreateOutboxMessageParams[] = [];

  async findAccountByEmail(email: string): Promise<AccountRow | null> {
    return this.accounts.find((a) => a.email === email) ?? null;
  }

  async executeInTransaction(params: {
    account: CreateAccountParams;
    leaderApplication: CreateLeaderApplicationParams;
    outboxMessage: CreateOutboxMessageParams;
  }): Promise<void> {
    this.createdAccounts.push(params.account);
    this.createdApplications.push(params.leaderApplication);
    this.createdOutboxMessages.push(params.outboxMessage);
  }
}

// ==================== テストデータ ====================

/**
 * 有効な入力データを生成する
 */
function validInput(
  overrides?: Partial<SubmitLeaderApplicationInput>
): SubmitLeaderApplicationInput {
  return {
    email: "test@example.com",
    displayName: "テストユーザー",
    projectTitle: "古民家を再生するプロジェクト",
    projectSummary: "地域の古民家を若者の交流拠点として再生します。",
    projectStory:
      "このプロジェクトは、過疎化が進む地域の古民家を活用し、若者が集まれる場所を作ることを目指しています。",
    projectCategory: "KOMINKA",
    prefectureCode: "26",
    municipality: "京都市",
    plannedActivities: "月に 2 回のワークショップを開催し、DIY で改修を進めます。",
    snsLinks: {
      x: "https://x.com/example",
      instagram: null,
      facebook: null,
      website: "https://example.com",
    },
    ipAddress: "192.168.1.1",
    captchaToken: "valid-captcha-token",
    ...overrides,
  };
}

// ==================== テスト ====================

describe("SubmitLeaderApplicationUseCase", () => {
  let port: InMemorySubmitLeaderApplicationPort;
  let useCase: SubmitLeaderApplicationUseCase;

  beforeEach(() => {
    port = new InMemorySubmitLeaderApplicationPort();
    useCase = new SubmitLeaderApplicationUseCase(port);
  });

  // ---- ハッピーパス ----

  it("有効な入力で応募を送信すると applicationId と accountId が返る", async () => {
    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.applicationId).toBeDefined();
    expect(result.value.accountId).toBeDefined();
    // UUID v4 形式
    expect(result.value.applicationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(result.value.accountId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("トランザクション内で Account / LeaderApplication / OutboxMessage が作成される", async () => {
    const input = validInput();
    const result = await useCase.execute(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Account
    expect(port.createdAccounts).toHaveLength(1);
    const account = port.createdAccounts[0];
    expect(account.email).toBe("test@example.com");
    expect(account.displayName).toBe("テストユーザー");
    expect(account.status).toBe("PENDING_EMAIL_CONFIRMATION");
    expect(account.roles).toEqual(["SUPPORTER"]);
    expect(account.activationToken).toBeDefined();
    expect(account.activationToken.length).toBe(64); // 32 bytes hex
    expect(account.activationTokenExp).toBeInstanceOf(Date);

    // LeaderApplication
    expect(port.createdApplications).toHaveLength(1);
    const app = port.createdApplications[0];
    expect(app.accountId).toBe(account.id);
    expect(app.status).toBe("PENDING");
    expect(app.projectTitle).toBe("古民家を再生するプロジェクト");
    expect(app.projectCategory).toBe("KOMINKA");
    expect(app.prefectureCode).toBe("26");
    expect(app.municipality).toBe("京都市");

    // OutboxMessage
    expect(port.createdOutboxMessages).toHaveLength(1);
    const outbox = port.createdOutboxMessages[0];
    expect(outbox.type).toBe("ACTIVATION_EMAIL");
    const payload = outbox.payload as {
      accountId: string;
      email: string;
      activationToken: string;
      displayName: string;
    };
    expect(payload.accountId).toBe(account.id);
    expect(payload.email).toBe("test@example.com");
    expect(payload.activationToken).toBe(account.activationToken);
    expect(payload.displayName).toBe("テストユーザー");
  });

  it("SNS リンクが未指定の場合は snsLinks が null になる", async () => {
    const result = await useCase.execute(validInput({ snsLinks: undefined }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(port.createdApplications[0].snsLinks).toBeNull();
  });

  it("municipality が未指定の場合は null になる", async () => {
    const result = await useCase.execute(validInput({ municipality: undefined }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(port.createdApplications[0].municipality).toBeNull();
  });

  // ---- バリデーションエラー ----

  it("必須フィールドが空の場合はバリデーションエラー", async () => {
    const result = await useCase.execute(validInput({ projectTitle: "" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
    if (result.error.type !== "VALIDATION_ERROR") return;
    expect(result.error.issues.length).toBeGreaterThan(0);
    expect(result.error.issues[0].path).toBe("projectTitle");
  });

  it("無効なメールアドレスの場合はバリデーションエラー", async () => {
    const result = await useCase.execute(validInput({ email: "invalid-email" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
    if (result.error.type !== "VALIDATION_ERROR") return;
    expect(result.error.issues[0].path).toBe("email");
  });

  it("無効なプロジェクトカテゴリの場合はバリデーションエラー", async () => {
    const result = await useCase.execute(
      validInput({ projectCategory: "INVALID_CATEGORY" as "KOMINKA" })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
    if (result.error.type !== "VALIDATION_ERROR") return;
    expect(result.error.issues[0].path).toBe("projectCategory");
  });

  it("無効な都道府県コードの場合はバリデーションエラー", async () => {
    const result = await useCase.execute(validInput({ prefectureCode: "99" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
    if (result.error.type !== "VALIDATION_ERROR") return;
    expect(result.error.issues[0].path).toBe("prefectureCode");
  });

  it("SNS URL が 500 文字を超える場合はバリデーションエラー", async () => {
    const longUrl = "https://x.com/" + "a".repeat(500);
    const result = await useCase.execute(validInput({ snsLinks: { x: longUrl } }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
    if (result.error.type !== "VALIDATION_ERROR") return;
    expect(result.error.issues[0].path).toBe("snsLinks.x");
  });

  it("プロジェクトタイトルが 100 文字を超える場合はバリデーションエラー", async () => {
    const result = await useCase.execute(validInput({ projectTitle: "あ".repeat(101) }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
  });

  it("表示名が 50 文字を超える場合はバリデーションエラー", async () => {
    const result = await useCase.execute(validInput({ displayName: "あ".repeat(51) }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
  });

  it("入力がオブジェクトでない場合はバリデーションエラー", async () => {
    const result = await useCase.execute(null);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
  });

  // ---- 重複チェック ----

  it("同じメールで PENDING_EMAIL_CONFIRMATION のアカウントが存在する場合は DUPLICATE_PENDING_APPLICATION", async () => {
    port.accounts.push({
      id: "existing-id",
      email: "test@example.com",
      status: "PENDING_EMAIL_CONFIRMATION",
    });

    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("DUPLICATE_PENDING_APPLICATION");
    if (result.error.type !== "DUPLICATE_PENDING_APPLICATION") return;
    expect(result.error.email).toBe("test@example.com");
  });

  it("同じメールで ACTIVE のアカウントが存在する場合は DUPLICATE_PENDING_APPLICATION", async () => {
    port.accounts.push({
      id: "existing-id",
      email: "test@example.com",
      status: "ACTIVE",
    });

    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("DUPLICATE_PENDING_APPLICATION");
  });

  // ---- アクティベーショントークン ----

  it("アクティベーショントークンの有効期限は 24 時間後", async () => {
    const before = new Date();
    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const account = port.createdAccounts[0];
    const expiry = account.activationTokenExp;
    const expectedMin = before.getTime() + 24 * 60 * 60 * 1000 - 1000;
    const expectedMax = Date.now() + 24 * 60 * 60 * 1000 + 1000;

    expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiry.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  // ---- 文字列トリム ----

  it("前後の空白がトリムされる", async () => {
    const result = await useCase.execute(
      validInput({
        displayName: "  テストユーザー  ",
        projectTitle: "  タイトル  ",
        municipality: "  京都市  ",
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(port.createdAccounts[0].displayName).toBe("テストユーザー");
    expect(port.createdApplications[0].projectTitle).toBe("タイトル");
    expect(port.createdApplications[0].municipality).toBe("京都市");
  });

  // ---- 電話番号 (Issue #192 / PR2) ----

  it("phoneNumber 未指定の場合は Account.phoneNumber が null になる", async () => {
    const result = await useCase.execute(validInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(port.createdAccounts[0].phoneNumber).toBeNull();
  });

  it("phoneNumber に空文字を指定した場合は Account.phoneNumber が null になる", async () => {
    const result = await useCase.execute(validInput({ phoneNumber: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(port.createdAccounts[0].phoneNumber).toBeNull();
  });

  it("phoneNumber に有効な電話番号を指定すると Account.phoneNumber に保存される", async () => {
    const result = await useCase.execute(validInput({ phoneNumber: "090-1234-5678" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(port.createdAccounts[0].phoneNumber).toBe("090-1234-5678");
  });

  it("phoneNumber が 20 文字超の場合は VALIDATION_ERROR", async () => {
    const result = await useCase.execute(validInput({ phoneNumber: "1".repeat(21) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("VALIDATION_ERROR");
  });

  it("phoneNumber に許可外文字が含まれる場合は VALIDATION_ERROR", async () => {
    const result = await useCase.execute(validInput({ phoneNumber: "090-abcd-5678" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("VALIDATION_ERROR");
    if (result.error.type !== "VALIDATION_ERROR") return;
    expect(result.error.issues.some((i) => i.path === "phoneNumber")).toBe(true);
  });
});
