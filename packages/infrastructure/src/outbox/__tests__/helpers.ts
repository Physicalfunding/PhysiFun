import type { AccountEmailLookup } from "../processors/types";

/**
 * テスト用の AccountEmailLookup スタブ。
 * accountId → email のマッピングを手動で設定する。
 */
export class StubAccountEmailLookup implements AccountEmailLookup {
  private readonly map = new Map<string, string>();

  set(accountId: string, email: string): void {
    this.map.set(accountId, email);
  }

  async findEmailByAccountId(accountId: string): Promise<string | null> {
    return this.map.get(accountId) ?? null;
  }
}
