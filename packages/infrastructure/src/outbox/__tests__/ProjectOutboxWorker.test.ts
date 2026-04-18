import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ok, err, type Result } from "@physifun/domain";
import { ProjectOutboxWorker } from "../ProjectOutboxWorker";
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
const mockUpdate = jest.fn<(...args: unknown[]) => Promise<MockMessage>>();

const mockPrisma = {
  projectOutboxMessage: {
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
  type: "admin_publish_request.notify",
  payload: { projectId: "p-1", projectTitle: "テスト" },
  createdAt: new Date("2026-04-17T00:00:00Z"),
  sentAt: null,
  attempts: 0,
  lastError: null,
  nextRetryAt: null,
  ...overrides,
});

describe("ProjectOutboxWorker", () => {
  let processor: StubProcessor;
  let worker: ProjectOutboxWorker;

  beforeEach(() => {
    mockFindMany.mockReset();
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(makeDbMessage());
    processor = new StubProcessor("admin_publish_request.notify");
    worker = new ProjectOutboxWorker(mockPrisma, [processor], {
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

  it("maxAttempts 到達時は retriable: true でも nextRetryAt を null にする (dead-letter)", async () => {
    mockFindMany.mockResolvedValue([makeDbMessage({ attempts: 9 })]);
    processor.result = err({
      message: "送信タイムアウト",
      retriable: true,
    });

    worker = new ProjectOutboxWorker(mockPrisma, [processor], {
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
        }),
      })
    );
  });

  it("正しい種別のプロセッサにディスパッチする", async () => {
    const otherProcessor = new StubProcessor("project_publish_approved.notify");
    worker = new ProjectOutboxWorker(mockPrisma, [processor, otherProcessor]);

    mockFindMany.mockResolvedValue([
      makeDbMessage({ id: "msg-1", type: "project_publish_approved.notify" }),
      makeDbMessage({ id: "msg-2", type: "admin_publish_request.notify" }),
    ]);

    await worker.tick();

    expect(otherProcessor.processedMessages).toHaveLength(1);
    expect(otherProcessor.processedMessages[0].id).toBe("msg-1");
    expect(processor.processedMessages).toHaveLength(1);
    expect(processor.processedMessages[0].id).toBe("msg-2");
  });
});
