import { describe, it, expect } from "@jest/globals";
import {
  CleanupExpiredPendingAccountsUseCase,
  type CleanupExpiredAccountsPort,
} from "../CleanupExpiredPendingAccountsUseCase";

/**
 * CleanupExpiredPendingAccountsUseCase のユニットテスト
 *
 * インメモリの Port 実装を使い、UseCase のロジックを検証する。
 */

/** 成功する Port のスタブ */
function createSuccessPort(deletedCount: number): CleanupExpiredAccountsPort {
  return {
    deleteExpiredPendingAccounts: async (_olderThan: Date) => deletedCount,
  };
}

/** 失敗する Port のスタブ */
function createFailurePort(message: string): CleanupExpiredAccountsPort {
  return {
    deleteExpiredPendingAccounts: async (_olderThan: Date) => {
      throw new Error(message);
    },
  };
}

describe("CleanupExpiredPendingAccountsUseCase", () => {
  it("期限切れアカウントを削除し、削除件数を返す", async () => {
    const port = createSuccessPort(5);
    const useCase = new CleanupExpiredPendingAccountsUseCase(port);

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deletedCount).toBe(5);
    }
  });

  it("期限切れアカウントが 0 件の場合、deletedCount が 0 を返す", async () => {
    const port = createSuccessPort(0);
    const useCase = new CleanupExpiredPendingAccountsUseCase(port);

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deletedCount).toBe(0);
    }
  });

  it("Port が失敗した場合、CLEANUP_FAILED エラーを返す", async () => {
    const port = createFailurePort("DB connection failed");
    const useCase = new CleanupExpiredPendingAccountsUseCase(port);

    const result = await useCase.execute();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("CLEANUP_FAILED");
      expect(result.error.message).toContain("DB connection failed");
    }
  });

  it("カットオフ日時として現在から 72 時間前を Port に渡す", async () => {
    let capturedDate: Date | undefined;
    const port: CleanupExpiredAccountsPort = {
      deleteExpiredPendingAccounts: async (olderThan: Date) => {
        capturedDate = olderThan;
        return 0;
      },
    };
    const useCase = new CleanupExpiredPendingAccountsUseCase(port);

    const before = new Date(Date.now() - 72 * 60 * 60 * 1000);
    await useCase.execute();
    const after = new Date(Date.now() - 72 * 60 * 60 * 1000);

    expect(capturedDate).toBeDefined();
    // カットオフ日時が 72 時間前の前後に収まることを確認
    expect(capturedDate!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(capturedDate!.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
