import { describe, it, expect, beforeEach } from "@jest/globals";
import { err, ok } from "@physifun/domain";
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
import type { CaptchaVerifierPort } from "../ports/CaptchaVerifierPort";
import type { IpRateLimitPort } from "../ports/IpRateLimitPort";

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

// ==================== フェイクポート (Issue #200) ====================

/**
 * 既定では常に成功する CAPTCHA フェイク。`shouldFail` を立てるとエラーを返す。
 */
class FakeCaptchaVerifier implements CaptchaVerifierPort {
  shouldFail = false;
  /** verify が呼ばれた回数とその引数を記録（呼び出し検証用） */
  calls: Array<{ token: string; remoteIp: string }> = [];

  async verify(input: { token: string; remoteIp: string }) {
    this.calls.push(input);
    if (this.shouldFail) {
      return err({ type: "CAPTCHA_VERIFICATION_FAILED" as const });
    }
    return ok(undefined);
  }
}

/**
 * 既定では常に通過する IP レートリミットフェイク。`shouldExceed` でエラーに切り替える。
 */
class FakeIpRateLimit implements IpRateLimitPort {
  shouldExceed = false;
  calls: string[] = [];

  consume(ipAddress: string) {
    this.calls.push(ipAddress);
    if (this.shouldExceed) {
      const retryAfter = 1800;
      return err({
        type: "RATE_LIMIT_EXCEEDED" as const,
        limit: 3,
        remaining: 0,
        retryAfterSeconds: retryAfter,
        reset: Math.floor(Date.now() / 1000) + retryAfter,
      });
    }
    return ok(undefined);
  }
}

// ==================== テストデータ ====================

/**
 * 有効な入力データを生成する
 *
 * Issue #192 PR3 の必須フィールドを満たす（progress / recruitmentTypes / experienceOffered
 * + TIME 募集枠の条件付き必須一式）。
 */
function validInput(
  overrides?: Partial<SubmitLeaderApplicationInput>
): SubmitLeaderApplicationInput {
  return {
    email: "test@example.com",
    displayName: "テストユーザー",
    projectTitle: "古民家を再生するプロジェクト",
    projectSummary: "地域の古民家を若者の交流拠点として再生します。",
    projectStory: "過疎化が進む地域の古民家を活用し、若者が集まれる場所を作ります。",
    projectCategory: "KOMINKA",
    prefectureCode: "26",
    municipality: "京都市",
    snsLinks: {
      x: "https://x.com/example",
      instagram: null,
      facebook: null,
      website: "https://example.com",
    },
    progress: "PLANNING",
    recruitmentTypes: ["TIME"],
    experienceOffered: "古民家再生の体験を提供します。",
    activityContent: "月に 2 回のワークショップを開催し、DIY で改修を進めます。",
    eventLocation: "京都市内の現地",
    eventPeriod: "2026年4月〜2026年12月",
    recruitCount: 10,
    timeReturn: "活動証明書と地元食材を返礼します。",
    skillItemNeeds: null,
    skillItemDeadline: null,
    skillItemReturn: null,
    phoneNumber: null,
    ipAddress: "192.168.1.1",
    captchaToken: "valid-captcha-token",
    ...overrides,
  };
}

// ==================== テスト ====================

describe("SubmitLeaderApplicationUseCase", () => {
  let port: InMemorySubmitLeaderApplicationPort;
  let captcha: FakeCaptchaVerifier;
  let rateLimit: FakeIpRateLimit;
  let useCase: SubmitLeaderApplicationUseCase;

  beforeEach(() => {
    port = new InMemorySubmitLeaderApplicationPort();
    captcha = new FakeCaptchaVerifier();
    rateLimit = new FakeIpRateLimit();
    useCase = new SubmitLeaderApplicationUseCase(port, captcha, rateLimit);
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
    expect(app.progress).toBe("PLANNING");
    expect(app.recruitmentTypes).toEqual(["TIME"]);
    expect(app.experienceOffered).toBe("古民家再生の体験を提供します。");
    expect(app.activityContent).toBe("月に 2 回のワークショップを開催し、DIY で改修を進めます。");

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

  it("プロジェクトタイトルが 60 文字を超える場合はバリデーションエラー（PR3 改訂値）", async () => {
    const result = await useCase.execute(validInput({ projectTitle: "あ".repeat(61) }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
  });

  it("プロジェクト概要が 150 文字を超える場合はバリデーションエラー（PR3 改訂値）", async () => {
    const result = await useCase.execute(validInput({ projectSummary: "あ".repeat(151) }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
  });

  it("プロジェクトストーリーが 300 文字を超える場合はバリデーションエラー（PR3 改訂値）", async () => {
    const result = await useCase.execute(validInput({ projectStory: "あ".repeat(301) }));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("VALIDATION_ERROR");
  });

  it("表示名が 50 文字を超える場合はバリデーションエラー", async () => {
    const result = await useCase.execute(validInput({ displayName: "あ".repeat(51) }));

    expect(result.ok).toBe(false);
    if (!result.ok) return;
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

  // ---- CAPTCHA / レートリミット (Issue #200) ----

  it("レートリミット超過時は RATE_LIMIT_EXCEEDED を返し、後続処理（CAPTCHA / DB）を呼ばない", async () => {
    rateLimit.shouldExceed = true;
    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("RATE_LIMIT_EXCEEDED");

    expect(rateLimit.calls).toEqual(["192.168.1.1"]);
    // レート制限で弾かれたら CAPTCHA も DB 書き込みも走らない
    expect(captcha.calls).toEqual([]);
    expect(port.createdAccounts).toHaveLength(0);
    expect(port.createdApplications).toHaveLength(0);
  });

  it("CAPTCHA 検証に失敗した場合は CAPTCHA_VERIFICATION_FAILED を返し、DB 書き込みを行わない", async () => {
    captcha.shouldFail = true;
    const result = await useCase.execute(validInput());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("CAPTCHA_VERIFICATION_FAILED");

    expect(captcha.calls).toEqual([{ token: "valid-captcha-token", remoteIp: "192.168.1.1" }]);
    expect(port.createdAccounts).toHaveLength(0);
    expect(port.createdApplications).toHaveLength(0);
  });

  it("正常系では CaptchaVerifierPort.verify が token / remoteIp 付きで呼ばれる", async () => {
    const result = await useCase.execute(validInput());
    expect(result.ok).toBe(true);
    expect(captcha.calls).toEqual([{ token: "valid-captcha-token", remoteIp: "192.168.1.1" }]);
    expect(rateLimit.calls).toEqual(["192.168.1.1"]);
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

  // ---- 電話番号 (Issue #192) ----

  it("phoneNumber 未指定の場合は Account.phoneNumber と LeaderApplication.phoneNumber が null になる", async () => {
    const result = await useCase.execute(validInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(port.createdAccounts[0].phoneNumber).toBeNull();
    expect(port.createdApplications[0].phoneNumber).toBeNull();
  });

  it("phoneNumber に有効な電話番号を指定すると Account / LeaderApplication 両方に保存される（PR3 スナップショット）", async () => {
    const result = await useCase.execute(validInput({ phoneNumber: "090-1234-5678" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(port.createdAccounts[0].phoneNumber).toBe("090-1234-5678");
    expect(port.createdApplications[0].phoneNumber).toBe("090-1234-5678");
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

  // ---- 応募フォーム拡張 (Issue #192 PR3) ----

  describe("progress (Issue #192 PR3 必須)", () => {
    it("無効な progress 値はバリデーションエラー", async () => {
      const result = await useCase.execute(validInput({ progress: "INVALID" as "PLANNING" }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("VALIDATION_ERROR");
      }
    });

    it("READY 等の他のフェーズ値も受け付ける", async () => {
      const result = await useCase.execute(validInput({ progress: "READY" }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(port.createdApplications[0].progress).toBe("READY");
      }
    });
  });

  describe("recruitmentTypes (Issue #192 PR3 必須・1件以上)", () => {
    it("空配列はバリデーションエラー", async () => {
      const result = await useCase.execute(validInput({ recruitmentTypes: [] }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("VALIDATION_ERROR");
      }
    });

    it("無効な値はバリデーションエラー", async () => {
      const result = await useCase.execute(validInput({ recruitmentTypes: ["INVALID" as "TIME"] }));
      expect(result.ok).toBe(false);
    });
  });

  describe("experienceOffered (Issue #192 PR3 必須・〜150)", () => {
    it("空文字はバリデーションエラー", async () => {
      const result = await useCase.execute(validInput({ experienceOffered: "" }));
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        expect(result.error.issues.some((i) => i.path === "experienceOffered")).toBe(true);
      }
    });

    it("151 文字はバリデーションエラー", async () => {
      const result = await useCase.execute(validInput({ experienceOffered: "あ".repeat(151) }));
      expect(result.ok).toBe(false);
    });

    it("150 文字ちょうどは OK", async () => {
      const result = await useCase.execute(validInput({ experienceOffered: "あ".repeat(150) }));
      expect(result.ok).toBe(true);
    });

    // PR #195 review M1: trim 後判定で必須・上限を整合させる
    it("半角スペースのみはバリデーションエラー（必須）", async () => {
      const result = await useCase.execute(validInput({ experienceOffered: " " }));
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        const issue = result.error.issues.find((i) => i.path === "experienceOffered");
        expect(issue?.message).toBe("体験できることは必須です");
      }
    });

    it("前後の空白は trim されて永続化される", async () => {
      const result = await useCase.execute(
        validInput({ experienceOffered: "  some experience  " })
      );
      expect(result.ok).toBe(true);
      expect(port.createdApplications[0].experienceOffered).toBe("some experience");
    });
  });

  describe("条件付き必須: TIME 募集枠", () => {
    function timeOnlyInput(
      overrides?: Partial<SubmitLeaderApplicationInput>
    ): SubmitLeaderApplicationInput {
      return validInput({
        recruitmentTypes: ["TIME"],
        skillItemNeeds: null,
        skillItemDeadline: null,
        skillItemReturn: null,
        ...overrides,
      });
    }

    it("activityContent が null の場合はバリデーションエラー", async () => {
      const result = await useCase.execute(timeOnlyInput({ activityContent: null }));
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        expect(result.error.issues.some((i) => i.path === "activityContent")).toBe(true);
      }
    });

    it("eventLocation が null の場合はバリデーションエラー", async () => {
      const result = await useCase.execute(timeOnlyInput({ eventLocation: null }));
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        expect(result.error.issues.some((i) => i.path === "eventLocation")).toBe(true);
      }
    });

    it("eventPeriod が null の場合はバリデーションエラー", async () => {
      const result = await useCase.execute(timeOnlyInput({ eventPeriod: null }));
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        expect(result.error.issues.some((i) => i.path === "eventPeriod")).toBe(true);
      }
    });

    it("recruitCount が null の場合はバリデーションエラー", async () => {
      const result = await useCase.execute(timeOnlyInput({ recruitCount: null }));
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        expect(result.error.issues.some((i) => i.path === "recruitCount")).toBe(true);
      }
    });

    it("recruitCount が 0 はバリデーションエラー", async () => {
      const result = await useCase.execute(timeOnlyInput({ recruitCount: 0 }));
      expect(result.ok).toBe(false);
    });

    it("timeReturn が null の場合はバリデーションエラー", async () => {
      const result = await useCase.execute(timeOnlyInput({ timeReturn: null }));
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        expect(result.error.issues.some((i) => i.path === "timeReturn")).toBe(true);
      }
    });

    it("activityContent が 200 文字超はバリデーションエラー", async () => {
      const result = await useCase.execute(timeOnlyInput({ activityContent: "あ".repeat(201) }));
      expect(result.ok).toBe(false);
    });
  });

  describe("条件付き必須: SKILL_ITEM 募集枠", () => {
    function skillOnlyInput(
      overrides?: Partial<SubmitLeaderApplicationInput>
    ): SubmitLeaderApplicationInput {
      return validInput({
        recruitmentTypes: ["SKILL_ITEM"],
        // TIME 関連は不要なので null
        activityContent: null,
        eventLocation: null,
        eventPeriod: null,
        recruitCount: null,
        timeReturn: null,
        // SKILL_ITEM 必須
        skillItemNeeds: "再生に使う古材を募集します。",
        skillItemDeadline: "2026年6月末",
        skillItemReturn: "古民家での宿泊体験をリターンとして提供します。",
        ...overrides,
      });
    }

    it("正常系: SKILL_ITEM 単独でも応募できる（TIME 関連は null のまま OK）", async () => {
      const result = await useCase.execute(skillOnlyInput());
      expect(result.ok).toBe(true);
      if (result.ok) {
        const app = port.createdApplications[0];
        expect(app.recruitmentTypes).toEqual(["SKILL_ITEM"]);
        expect(app.activityContent).toBeNull();
        expect(app.eventLocation).toBeNull();
        expect(app.recruitCount).toBeNull();
        expect(app.timeReturn).toBeNull();
        expect(app.skillItemNeeds).toBe("再生に使う古材を募集します。");
      }
    });

    it("skillItemNeeds が null の場合はバリデーションエラー", async () => {
      const result = await useCase.execute(skillOnlyInput({ skillItemNeeds: null }));
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        expect(result.error.issues.some((i) => i.path === "skillItemNeeds")).toBe(true);
      }
    });

    it("skillItemDeadline が null の場合はバリデーションエラー", async () => {
      const result = await useCase.execute(skillOnlyInput({ skillItemDeadline: null }));
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        expect(result.error.issues.some((i) => i.path === "skillItemDeadline")).toBe(true);
      }
    });

    it("skillItemReturn が null の場合はバリデーションエラー", async () => {
      const result = await useCase.execute(skillOnlyInput({ skillItemReturn: null }));
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        expect(result.error.issues.some((i) => i.path === "skillItemReturn")).toBe(true);
      }
    });
  });

  describe("条件付き必須: TIME + SKILL_ITEM の両方", () => {
    it("両方を選択した場合、両方の必須群が満たされていれば OK", async () => {
      const result = await useCase.execute(
        validInput({
          recruitmentTypes: ["TIME", "SKILL_ITEM"],
          activityContent: "ワークショップを実施します。",
          eventLocation: "現地",
          eventPeriod: "通年",
          recruitCount: 5,
          timeReturn: "活動証明書",
          skillItemNeeds: "古材",
          skillItemDeadline: "2026年6月末",
          skillItemReturn: "宿泊券",
        })
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(port.createdApplications[0].recruitmentTypes).toEqual(["TIME", "SKILL_ITEM"]);
      }
    });

    it("両方選択時に SKILL_ITEM 系が欠落しているとバリデーションエラー", async () => {
      const result = await useCase.execute(
        validInput({
          recruitmentTypes: ["TIME", "SKILL_ITEM"],
          // TIME 系は揃っている。SKILL_ITEM 系が null
          skillItemNeeds: null,
          skillItemDeadline: null,
          skillItemReturn: null,
        })
      );
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "VALIDATION_ERROR") {
        const paths = result.error.issues.map((i) => i.path);
        expect(paths).toContain("skillItemNeeds");
        expect(paths).toContain("skillItemDeadline");
        expect(paths).toContain("skillItemReturn");
      }
    });
  });
});
