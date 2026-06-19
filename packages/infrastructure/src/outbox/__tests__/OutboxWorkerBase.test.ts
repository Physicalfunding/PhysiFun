import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ok, err, type Result } from "@physifun/domain";
import {
  OutboxWorkerBase,
  type OutboxDelegate,
  type OutboxRow,
  type OutboxUpdate,
} from "../OutboxWorkerBase";
import type { OutboxMessage, OutboxProcessor, OutboxProcessError } from "../types";

/**
 * OutboxWorkerBase の単体テスト（#226 で claim を atomic claimBatch へ移行）。
 *
 * delegate（claimBatch / update）をモックし、ディスパッチ・成功/失敗・backoff・
 * dead-letter・claim 解放のロジックを検証する。atomic claim 自体（FOR UPDATE SKIP LOCKED）
 * は実 PostgreSQL 統合テスト（test/outbox/KyselyOutbox.vitest.ts）で担保する。
 */

const mockClaimBatch =
  jest.fn<
    (params: {
      now: Date;
      claimExpiry: Date;
      claimToken: string;
      batchSize: number;
    }) => Promise<OutboxRow[]>
  >();
const mockUpdate = jest.fn<(id: string, patch: OutboxUpdate) => Promise<void>>();

const delegate: OutboxDelegate = {
  claimBatch: mockClaimBatch,
  update: mockUpdate,
};

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

const makeRow = (overrides?: Partial<OutboxRow>): OutboxRow => ({
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

describe("OutboxWorkerBase", () => {
  let processor: StubProcessor;
  let worker: OutboxWorkerBase;

  beforeEach(() => {
    mockClaimBatch.mockReset();
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
    processor = new StubProcessor("ACTIVATION_EMAIL");
    worker = new OutboxWorkerBase(delegate, [processor], { baseBackoffSeconds: 30 });
  });

  it("claim したメッセージを処理する", async () => {
    mockClaimBatch.mockResolvedValue([makeRow()]);

    await worker.tick();

    expect(processor.processedMessages).toHaveLength(1);
    expect(processor.processedMessages[0].id).toBe("msg-1");
  });

  it("claimBatch に now / claimExpiry / token / batchSize を渡す（claimExpiry < now）", async () => {
    mockClaimBatch.mockResolvedValue([]);

    await worker.tick();

    expect(mockClaimBatch).toHaveBeenCalledTimes(1);
    const arg = mockClaimBatch.mock.calls[0][0];
    expect(arg.now).toBeInstanceOf(Date);
    expect(arg.claimExpiry).toBeInstanceOf(Date);
    expect(typeof arg.claimToken).toBe("string");
    expect(arg.claimToken.length).toBeGreaterThan(0);
    expect(arg.batchSize).toBeGreaterThan(0);
    expect(arg.claimExpiry.getTime()).toBeLessThan(arg.now.getTime());
  });

  it("成功時に sentAt 記録 + claim 解放", async () => {
    mockClaimBatch.mockResolvedValue([makeRow()]);

    await worker.tick();

    expect(mockUpdate).toHaveBeenCalledWith(
      "msg-1",
      expect.objectContaining({ sentAt: expect.any(Date), releaseClaim: true })
    );
  });

  it("失敗(retriable)時に attempts+1 / lastError / exponential backoff / claim 解放", async () => {
    const now = Date.now();
    mockClaimBatch.mockResolvedValue([makeRow({ attempts: 1 })]);
    processor.result = err({ message: "一時障害", retriable: true });

    await worker.tick();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [id, patch] = mockUpdate.mock.calls[0];
    expect(id).toBe("msg-1");
    expect(patch.attempts).toBe(2);
    expect(patch.lastError).toBe("一時障害");
    expect(patch.releaseClaim).toBe(true);
    expect(patch.deadLetteredAt).toBeUndefined();
    // attempts=2 → delay = 30 * 2^(2-1) = 60秒
    const diff = (patch.nextRetryAt as Date).getTime() - now;
    expect(diff).toBeGreaterThan(55_000);
    expect(diff).toBeLessThan(65_000);
  });

  it("retriable:false は dead-letter 化（nextRetryAt null + deadLetteredAt）", async () => {
    mockClaimBatch.mockResolvedValue([makeRow()]);
    processor.result = err({ message: "宛先不正", retriable: false });

    await worker.tick();

    const [, patch] = mockUpdate.mock.calls[0];
    expect(patch.nextRetryAt).toBeNull();
    expect(patch.deadLetteredAt).toBeInstanceOf(Date);
    expect(patch.releaseClaim).toBe(true);
  });

  it("maxAttempts 到達時は retriable でも dead-letter 化", async () => {
    mockClaimBatch.mockResolvedValue([makeRow({ attempts: 9 })]);
    processor.result = err({ message: "送信タイムアウト", retriable: true });
    worker = new OutboxWorkerBase(delegate, [processor], {
      baseBackoffSeconds: 30,
      maxAttempts: 10,
    });

    await worker.tick();

    const [, patch] = mockUpdate.mock.calls[0];
    expect(patch.attempts).toBe(10);
    expect(patch.nextRetryAt).toBeNull();
    expect(patch.deadLetteredAt).toBeInstanceOf(Date);
  });

  it("未知のメッセージ種別は dead-letter 化してスキップ（claim 解放）", async () => {
    mockClaimBatch.mockResolvedValue([makeRow({ type: "UNKNOWN_TYPE" })]);

    await worker.tick();

    expect(processor.processedMessages).toHaveLength(0);
    const [, patch] = mockUpdate.mock.calls[0];
    expect(patch.lastError).toContain("未知のメッセージ種別");
    expect(patch.deadLetteredAt).toBeInstanceOf(Date);
    expect(patch.releaseClaim).toBe(true);
  });

  it("claim 0 件なら update を呼ばない", async () => {
    mockClaimBatch.mockResolvedValue([]);

    await worker.tick();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(processor.processedMessages).toHaveLength(0);
  });

  it("複数メッセージを順次処理する", async () => {
    mockClaimBatch.mockResolvedValue([makeRow({ id: "m1" }), makeRow({ id: "m2" })]);

    await worker.tick();

    expect(processor.processedMessages).toHaveLength(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("type で正しい processor にディスパッチする", async () => {
    const other = new StubProcessor("OTHER_TYPE");
    worker = new OutboxWorkerBase(delegate, [processor, other]);
    mockClaimBatch.mockResolvedValue([
      makeRow({ id: "m1", type: "OTHER_TYPE" }),
      makeRow({ id: "m2", type: "ACTIVATION_EMAIL" }),
    ]);

    await worker.tick();

    expect(other.processedMessages.map((m) => m.id)).toEqual(["m1"]);
    expect(processor.processedMessages.map((m) => m.id)).toEqual(["m2"]);
  });
});
