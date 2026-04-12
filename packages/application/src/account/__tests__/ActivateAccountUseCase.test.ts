import { describe, it, expect } from "@jest/globals";
import { ActivateAccountUseCase, type ActivateAccountError } from "../ActivateAccountUseCase";
import type {
  ActivateAccountPort,
  AccountForActivation,
  PasswordHasher,
} from "../ports/ActivateAccountPort";

// --- テスト用インメモリ実装 ---

class InMemoryActivateAccountPort implements ActivateAccountPort {
  private accounts: Map<string, AccountForActivation & { token: string }> = new Map();
  public activatedAccounts: Map<string, { passwordHash: string }> = new Map();

  addAccount(token: string, account: AccountForActivation): void {
    this.accounts.set(token, { ...account, token });
  }

  async findByActivationToken(token: string): Promise<AccountForActivation | null> {
    const entry = this.accounts.get(token);
    return entry
      ? { id: entry.id, status: entry.status, activationTokenExp: entry.activationTokenExp }
      : null;
  }

  async activate(params: { accountId: string; passwordHash: string }): Promise<void> {
    this.activatedAccounts.set(params.accountId, {
      passwordHash: params.passwordHash,
    });
  }
}

class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }
}

// --- ヘルパー ---

/** 未来の日時を返す */
function futureDate(hours = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/** 過去の日時を返す */
function pastDate(hours = 1): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function createUseCase(port: InMemoryActivateAccountPort) {
  return new ActivateAccountUseCase(port, new FakePasswordHasher());
}

// --- テスト ---

describe("ActivateAccountUseCase", () => {
  it("正常系: 有効なトークンとパスワードでアカウントが有効化される", async () => {
    const port = new InMemoryActivateAccountPort();
    port.addAccount("valid-token", {
      id: "account-1",
      status: "PENDING_EMAIL_CONFIRMATION",
      activationTokenExp: futureDate(),
    });
    const useCase = createUseCase(port);

    const result = await useCase.execute({
      token: "valid-token",
      password: "Passw0rd",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.accountId).toBe("account-1");
    }
    // ポートに正しいハッシュが渡されたことを確認
    expect(port.activatedAccounts.get("account-1")).toEqual({
      passwordHash: "hashed:Passw0rd",
    });
  });

  it("トークンが見つからない場合 TOKEN_NOT_FOUND を返す", async () => {
    const port = new InMemoryActivateAccountPort();
    const useCase = createUseCase(port);

    const result = await useCase.execute({
      token: "nonexistent-token",
      password: "Passw0rd",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("TOKEN_NOT_FOUND");
    }
  });

  it("トークンが有効期限切れの場合 TOKEN_EXPIRED を返す", async () => {
    const port = new InMemoryActivateAccountPort();
    port.addAccount("expired-token", {
      id: "account-2",
      status: "PENDING_EMAIL_CONFIRMATION",
      activationTokenExp: pastDate(),
    });
    const useCase = createUseCase(port);

    const result = await useCase.execute({
      token: "expired-token",
      password: "Passw0rd",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("TOKEN_EXPIRED");
    }
  });

  it("アカウントが既に ACTIVE の場合 ACCOUNT_ALREADY_ACTIVE を返す", async () => {
    const port = new InMemoryActivateAccountPort();
    port.addAccount("used-token", {
      id: "account-3",
      status: "ACTIVE",
      activationTokenExp: futureDate(),
    });
    const useCase = createUseCase(port);

    const result = await useCase.execute({
      token: "used-token",
      password: "Passw0rd",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("ACCOUNT_ALREADY_ACTIVE");
    }
  });

  it("パスワードが8文字未満の場合 INVALID_PASSWORD を返す", async () => {
    const port = new InMemoryActivateAccountPort();
    port.addAccount("token-short-pw", {
      id: "account-4",
      status: "PENDING_EMAIL_CONFIRMATION",
      activationTokenExp: futureDate(),
    });
    const useCase = createUseCase(port);

    const result = await useCase.execute({
      token: "token-short-pw",
      password: "Pass1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_PASSWORD");
    }
  });

  it("パスワードに数字が含まれない場合 INVALID_PASSWORD を返す", async () => {
    const port = new InMemoryActivateAccountPort();
    port.addAccount("token-no-digit", {
      id: "account-5",
      status: "PENDING_EMAIL_CONFIRMATION",
      activationTokenExp: futureDate(),
    });
    const useCase = createUseCase(port);

    const result = await useCase.execute({
      token: "token-no-digit",
      password: "Password",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_PASSWORD");
    }
  });

  it("パスワードに英字が含まれない場合 INVALID_PASSWORD を返す", async () => {
    const port = new InMemoryActivateAccountPort();
    port.addAccount("token-no-letter", {
      id: "account-6",
      status: "PENDING_EMAIL_CONFIRMATION",
      activationTokenExp: futureDate(),
    });
    const useCase = createUseCase(port);

    const result = await useCase.execute({
      token: "token-no-letter",
      password: "12345678",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_PASSWORD");
    }
  });

  it("トークンが空文字の場合 INVALID_INPUT を返す", async () => {
    const port = new InMemoryActivateAccountPort();
    const useCase = createUseCase(port);

    const result = await useCase.execute({
      token: "",
      password: "Passw0rd",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_INPUT");
    }
  });

  it("パスワードが空文字の場合 INVALID_INPUT を返す", async () => {
    const port = new InMemoryActivateAccountPort();
    const useCase = createUseCase(port);

    const result = await useCase.execute({
      token: "some-token",
      password: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_INPUT");
    }
  });
});
