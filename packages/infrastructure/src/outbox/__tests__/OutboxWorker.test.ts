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
};

const mockFindMany = jest.fn<() => Promise<MockMessage[]>>();
const mockUpdate = jest.fn<() => Promise<MockMessage>>();

const mockPrisma = {
  leaderApplicationOutboxMessage: {
    findMany: mockFindMany,
    update: mockUpdate,
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
  ...overrides,
});

describe("OutboxWorker", () => {
  let processor: StubProcessor;
  let worker: OutboxWorker;

  beforeEach(() => {
    mockFindMany.mockReset();
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(makeDbMessage());
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
          attempts: 3,
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

  it("retriable: false のエラー時は nextRetryAt を null にする (dead-letter)", async () => {
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
        }),
      })
    );
  });

  it("未知のメッセージ種別は lastError に記録してスキップする", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage({ type: "UNKNOWN_TYPE" })]);

    await worker.tick();

    expect(processor.processedMessages).toHaveLength(0);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: expect.stringContaining("未知のメッセージ種別"),
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
});
