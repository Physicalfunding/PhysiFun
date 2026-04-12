import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  CreateProjectDraftUseCase,
  MAX_PROJECTS_PER_LEADER,
  type CreateProjectDraftError,
} from "../CreateProjectDraftUseCase";
import type {
  CreateProjectDraftPort,
  AccountForProjectCreation,
} from "../ports/CreateProjectDraftPort";
import { Project, AccountId } from "@physifun/domain";

// ==================== テストヘルパー ====================

// テスト用の固定 UUID
const ACCOUNT_ID_STR = "00000000-0000-4000-a000-000000000001";

/** LEADER ロールを持つアカウント */
function leaderAccount(overrides?: Partial<AccountForProjectCreation>): AccountForProjectCreation {
  return {
    id: ACCOUNT_ID_STR,
    roles: ["SUPPORTER", "LEADER"],
    ...overrides,
  };
}

/** SUPPORTER ロールのみのアカウント */
function supporterAccount(overrides?: Partial<AccountForProjectCreation>): AccountForProjectCreation {
  return {
    id: ACCOUNT_ID_STR,
    roles: ["SUPPORTER"],
    ...overrides,
  };
}

// ==================== インメモリ実装 ====================

/**
 * テスト用のインメモリポート実装
 */
class InMemoryCreateProjectDraftPort implements CreateProjectDraftPort {
  /** 保存済みアカウント */
  accounts: AccountForProjectCreation[] = [];

  /** オーナーごとのプロジェクト数 */
  projectCounts: Map<string, number> = new Map();

  /** saveProject で渡されたプロジェクトを記録 */
  savedProjects: Project[] = [];

  async findAccountById(accountId: string): Promise<AccountForProjectCreation | null> {
    return this.accounts.find((a) => a.id === accountId) ?? null;
  }

  async countProjectsByOwner(accountId: string): Promise<number> {
    return this.projectCounts.get(accountId) ?? 0;
  }

  async saveProject(project: Project): Promise<void> {
    this.savedProjects.push(project);
  }
}

// ==================== テスト ====================

describe("CreateProjectDraftUseCase", () => {
  let port: InMemoryCreateProjectDraftPort;
  let useCase: CreateProjectDraftUseCase;

  beforeEach(() => {
    port = new InMemoryCreateProjectDraftPort();
    useCase = new CreateProjectDraftUseCase(port);
  });

  // ---- ハッピーパス ----

  it("LEADER がドラフトを作成すると projectId が返る", async () => {
    port.accounts.push(leaderAccount());

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      title: "テストプロジェクト",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.projectId).toBeDefined();
    expect(result.value.projectId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("saveProject が正しいプロジェクトで呼ばれる", async () => {
    port.accounts.push(leaderAccount());

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      title: "テストプロジェクト",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(port.savedProjects).toHaveLength(1);
    const saved = port.savedProjects[0];
    expect(saved.id.toString()).toBe(result.value.projectId);
    expect(saved.ownerAccountId.toString()).toBe(ACCOUNT_ID_STR);
    expect(saved.title).toBe("テストプロジェクト");
  });

  // ---- エラーケース ----

  it("存在しないアカウントで ACCOUNT_NOT_FOUND", async () => {
    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      title: "テストプロジェクト",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("ACCOUNT_NOT_FOUND");
  });

  it("SUPPORTER のみのアカウントで NOT_LEADER", async () => {
    port.accounts.push(supporterAccount());

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      title: "テストプロジェクト",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("NOT_LEADER");
  });

  it("プロジェクト数が上限に達している場合 PROJECT_LIMIT_EXCEEDED", async () => {
    port.accounts.push(leaderAccount());
    port.projectCounts.set(ACCOUNT_ID_STR, 10);

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      title: "テストプロジェクト",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("PROJECT_LIMIT_EXCEEDED");
    if (result.error.type !== "PROJECT_LIMIT_EXCEEDED") return;
    expect(result.error.max).toBe(MAX_PROJECTS_PER_LEADER);
    expect(result.error.current).toBe(10);
  });

  it("タイトルが空文字の場合 DOMAIN_ERROR", async () => {
    port.accounts.push(leaderAccount());

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      title: "",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("DOMAIN_ERROR");
    if (result.error.type !== "DOMAIN_ERROR") return;
    expect(result.error.domainError.type).toBe("TITLE_REQUIRED");
  });

  it("不正な accountId 形式で INVALID_ACCOUNT_ID", async () => {
    const result = await useCase.execute({
      accountId: "not-a-uuid",
      title: "テストプロジェクト",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("INVALID_ACCOUNT_ID");
    expect(port.savedProjects).toHaveLength(0);
  });

  it("エラー時は saveProject が呼ばれない", async () => {
    port.accounts.push(leaderAccount());

    await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      title: "",
    });

    expect(port.savedProjects).toHaveLength(0);
  });

  it("タイトルが101文字の場合 DOMAIN_ERROR", async () => {
    port.accounts.push(leaderAccount());

    const result = await useCase.execute({
      accountId: ACCOUNT_ID_STR,
      title: "あ".repeat(101),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("DOMAIN_ERROR");
    if (result.error.type !== "DOMAIN_ERROR") return;
    expect(result.error.domainError.type).toBe("TITLE_TOO_LONG");
  });
});
