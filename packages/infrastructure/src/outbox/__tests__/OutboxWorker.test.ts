import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ok, err, type Result } from "@physifun/domain";
import { OutboxWorker } from "../OutboxWorker";
import type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "../types";

// --- Prisma モック ---
type MockMessage = {
  id: string;
  type: string;
  payload: unknown;
  createdAt: Date;
  sentAt: Date | null;
  attempts: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  deadLetteredAt: Date | null;
};

const mockFindMany = jest.fn<(...args: unknown[]) => Promise<MockMessage[]>>();
const mockUpdate = jest.fn<(...args: unknown[]) => Promise<MockMessage>>();
const mockUpdateMany = jest.fn<(...args: unknown[]) => Promise<{ count: number }>>();

const mockPrisma = {
  leaderApplicationOutboxMessage: {
    findMany: mockFindMany,
    update: mockUpdate,
    updateMany: mockUpdateMany,
  },
} as any;

// --- テスト用 Processor ---
class StubProcessor implements OutboxProcessor {
  readonly type: string;
  result: Result<void, OutboxProcessError> = ok(undefined);
  processedMessages: OutboxMessage[] = [];

  constructor(type: string) {
    this.type = type;
  }

  async process(message: OutboxMessage): Promise<Result<void, OutboxProcessError>> {
    this.processedMessages.push(message);
    return this.result;
  }
}

// --- ヘルパー ---
const makeDbMessage = (overrides?: Partial<MockMessage>): MockMessage => ({
  id: "msg-1",
  type: "ACTIVATION_EMAIL",
  payload: { email: "test@example.com" },
  createdAt: new Date("2026-01-01T00:00:00Z"),
  sentAt: null,
  attempts: 0,
  lastError: null,
  nextRetryAt: null,
  deadLetteredAt: null,
  ...overrides,
});

describe("OutboxWorker", () => {
  let processor: StubProcessor;
  let worker: OutboxWorker;

  beforeEach(() => {
    mockFindMany.mockReset();
    mockUpdate.mockReset();
    mockUpdateMany.mockReset();
    mockUpdate.mockResolvedValue(makeDbMessage());
    mockUpdateMany.mockResolvedValue({ count: 1 });
    processor = new StubProcessor("ACTIVATION_EMAIL");
    worker = new OutboxWorker(mockPrisma, [processor], {
      baseBackoffSeconds: 30,
    });
  });

  it("未送信メッセージをポーリングして処理する", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage()]);

    await worker.tick();

    expect(processor.processedMessages).toHaveLength(1);
    expect(processor.processedMessages[0].id).toBe("msg-1");
  });

  it("成功時に sentAt を更新する", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage()]);

    await worker.tick();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-1" },
        data: expect.objectContaining({
          sentAt: expect.any(Date),
        }),
      })
    );
  });

  it("ポーリング時に deadLetteredAt: null を条件に含める", async () => {
    mockFindMany.mockResolvedValue([]);

    await worker.tick();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sentAt: null,
          deadLetteredAt: null,
        }),
      })
    );
  });

  it("失敗時に attempts をインクリメントし lastError を記録する", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage({ attempts: 2 })]);
    processor.result = err({
      message: "送信タイムアウト",
      retriable: true,
    });

    await worker.tick();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-1" },
        data: expect.objectContaining({
          attempts: { increment: 1 },
          lastError: "送信タイムアウト",
        }),
      })
    );
  });

  it("retriable エラー時に exponential backoff で nextRetryAt を設定する", async () => {
    const now = Date.now();
    mockFindMany.mockResolvedValue([makeDbMessage({ attempts: 1 })]);
    processor.result = err({
      message: "一時障害",
      retriable: true,
    });

    await worker.tick();

    const updateCall = mockUpdate.mock.calls[0][0] as any;
    const nextRetryAt = updateCall.data.nextRetryAt as Date;

    // attempts=2 → delay = 30 * 2^(2-1) = 60秒
    expect(nextRetryAt).toBeInstanceOf(Date);
    const diffMs = nextRetryAt.getTime() - now;
    // 60秒 ± 5秒の許容範囲
    expect(diffMs).toBeGreaterThan(55_000);
    expect(diffMs).toBeLessThan(65_000);
  });

  it("retriable: false のエラー時は dead-letter 化する", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage()]);
    processor.result = err({
      message: "宛先不正",
      retriable: false,
    });

    await worker.tick();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextRetryAt: null,
          deadLetteredAt: expect.any(Date),
        }),
      })
    );
  });

  it("未知のメッセージ種別は dead-letter 化してスキップする", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage({ type: "UNKNOWN_TYPE" })]);

    await worker.tick();

    expect(processor.processedMessages).toHaveLength(0);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: expect.stringContaining("未知のメッセージ種別"),
          deadLetteredAt: expect.any(Date),
        }),
      })
    );
  });

  it("メッセージが 0 件の場合は何もしない", async () => {
    mockFindMany.mockResolvedValue([]);

    await worker.tick();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(processor.processedMessages).toHaveLength(0);
  });

  it("複数メッセージを順次処理する", async () => {
    mockFindMany.mockResolvedValue([
      makeDbMessage({ id: "msg-1" }),
      makeDbMessage({ id: "msg-2" }),
    ]);

    await worker.tick();

    expect(processor.processedMessages).toHaveLength(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("maxAttempts 到達時は retriable: true でも dead-letter 化する", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage({ attempts: 9 })]);
    processor.result = err({
      message: "送信タイムアウト",
      retriable: true,
    });

    worker = new OutboxWorker(mockPrisma, [processor], {
      baseBackoffSeconds: 30,
      maxAttempts: 10,
    });

    await worker.tick();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attempts: { increment: 1 },
          lastError: "送信タイムアウト",
          nextRetryAt: null,
          deadLetteredAt: expect.any(Date),
        }),
      })
    );
  });

  it("正しい種別のプロセッサにディスパッチする", async () => {
    const otherProcessor = new StubProcessor("OTHER_TYPE");
    worker = new OutboxWorker(mockPrisma, [processor, otherProcessor]);

    mockFindMany.mockResolvedValue([
      makeDbMessage({ id: "msg-1", type: "OTHER_TYPE" }),
      makeDbMessage({ id: "msg-2", type: "ACTIVATION_EMAIL" }),
    ]);

    await worker.tick();

    expect(otherProcessor.processedMessages).toHaveLength(1);
    expect(otherProcessor.processedMessages[0].id).toBe("msg-1");
    expect(processor.processedMessages).toHaveLength(1);
    expect(processor.processedMessages[0].id).toBe("msg-2");
  });

  // ==================== claim/lock (#187 PR2 review HIGH) ====================

  it("tick() は updateMany で claim を取得する (claimedAt + claimedBy セット)", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage()]);

    await worker.tick();

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    const call = mockUpdateMany.mock.calls[0][0] as any;
    expect(call.data.claimedAt).toBeInstanceOf(Date);
    expect(typeof call.data.claimedBy).toBe("string");
    expect(call.data.claimedBy.length).toBeGreaterThan(0);
  });

  it("候補取得 findMany の WHERE に claim 期限切れ条件を含む", async () => {
    mockFindMany.mockResolvedValue([]);

    await worker.tick();

    const firstCall = mockFindMany.mock.calls[0][0] as any;
    // AND の中に claim 条件が入っているはず
    expect(firstCall.where.AND).toBeDefined();
    const andClauses = firstCall.where.AND as Array<{ OR: unknown[] }>;
    const hasClaimClause = andClauses.some(
      (c) =>
        Array.isArray(c.OR) &&
        c.OR.some((sub) => typeof sub === "object" && sub !== null && "claimedAt" in sub)
    );
    expect(hasClaimClause).toBe(true);
  });

  it("claim 後の取得 findMany は claimedBy = token で絞り込む", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage()]);

    await worker.tick();

    // tick() 内で findMany が 2 回呼ばれる: candidates → claimed
    expect(mockFindMany).toHaveBeenCalledTimes(2);
    const secondCall = mockFindMany.mock.calls[1][0] as any;
    expect(secondCall.where).toMatchObject({
      sentAt: null,
    });
    expect(typeof secondCall.where.claimedBy).toBe("string");
  });

  it("成功時に claim を解放する (claimedAt: null, claimedBy: null)", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage()]);

    await worker.tick();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sentAt: expect.any(Date),
          claimedAt: null,
          claimedBy: null,
        }),
      })
    );
  });

  it("失敗時 (retriable) に claim を解放する", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage()]);
    processor.result = err({ message: "tmp", retriable: true });

    await worker.tick();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          claimedAt: null,
          claimedBy: null,
        }),
      })
    );
  });

  it("dead-letter 時にも claim を解放する", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage()]);
    processor.result = err({ message: "fatal", retriable: false });

    await worker.tick();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deadLetteredAt: expect.any(Date),
          claimedAt: null,
          claimedBy: null,
        }),
      })
    );
  });

  it("未知種別 dead-letter 時にも claim を解放する", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage({ type: "UNKNOWN_TYPE" })]);

    await worker.tick();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deadLetteredAt: expect.any(Date),
          claimedAt: null,
          claimedBy: null,
        }),
      })
    );
  });

  it("候補が他ワーカーに claim 済みで取得 findMany が空の場合は処理しない", async () => {
    // Step 1: candidate 1 件あり
    // Step 3: 自分が claim できた行は 0 件 (= 他ワーカーが先に取った)
    mockFindMany
      .mockResolvedValueOnce([makeDbMessage()])
      .mockResolvedValueOnce([]);

    await worker.tick();

    expect(processor.processedMessages).toHaveLength(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("候補が 0 件なら updateMany を呼ばない", async () => {
    mockFindMany.mockResolvedValue([]);

    await worker.tick();

    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
