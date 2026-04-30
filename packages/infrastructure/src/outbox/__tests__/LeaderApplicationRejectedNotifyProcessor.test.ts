import { describe, it, expect, beforeEach } from "@jest/globals";
import { err } from "@physifun/domain";
import { NoopMailSender } from "../../mail/NoopMailSender";
import {
  LeaderApplicationRejectedNotifyProcessor,
  LEADER_APPLICATION_REJECTED_NOTIFY_TYPE,
  type LeaderApplicationRejectedNotifyPayload,
} from "../processors/LeaderApplicationRejectedNotifyProcessor";
import type { AccountEmailLookup } from "../processors/types";
import type { OutboxMessage } from "../types";

class StubAccountEmailLookup implements AccountEmailLookup {
  constructor(private readonly map: Map<string, string | null>) {}
  async findEmailByAccountId(accountId: string): Promise<string | null> {
    return this.map.get(accountId) ?? null;
  }
}

describe("LeaderApplicationRejectedNotifyProcessor", () => {
  let mailSender: NoopMailSender;
  let lookup: StubAccountEmailLookup;
  let processor: LeaderApplicationRejectedNotifyProcessor;

  const makeMessage = (
    overrides?: Partial<LeaderApplicationRejectedNotifyPayload>
  ): OutboxMessage<LeaderApplicationRejectedNotifyPayload> => ({
    id: "msg-1",
    type: LEADER_APPLICATION_REJECTED_NOTIFY_TYPE,
    payload: {
      applicationId: "app-1",
      accountId: "acc-1",
      reviewerNote: "応募内容が要件を満たしていません",
      ...overrides,
    },
    createdAt: new Date("2026-05-01T00:00:00Z"),
    sentAt: null,
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
    deadLetteredAt: null,
  });

  beforeEach(() => {
    mailSender = new NoopMailSender();
    lookup = new StubAccountEmailLookup(new Map([["acc-1", "applicant@example.com"]]));
    processor = new LeaderApplicationRejectedNotifyProcessor(mailSender, lookup);
  });

  it("type は rejected.notify_applicant", () => {
    expect(processor.type).toBe("rejected.notify_applicant");
  });

  it("AccountEmailLookup で解決した email 宛に送信する", async () => {
    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(true);
    expect(mailSender.sentMessages).toHaveLength(1);
    expect(mailSender.sentMessages[0].to).toBe("applicant@example.com");
  });

  it("本文に reviewerNote を含む", async () => {
    await processor.process(makeMessage({ reviewerNote: "活動実績が不足しています" }));

    const sent = mailSender.sentMessages[0];
    expect(sent.text).toContain("活動実績が不足しています");
    expect(sent.html).toContain("活動実績が不足しています");
  });

  it("reviewerNote の HTML 特殊文字をエスケープする", async () => {
    await processor.process(makeMessage({ reviewerNote: "<script>alert('x')</script>" }));

    const sent = mailSender.sentMessages[0];
    expect(sent.html).not.toContain("<script>");
    expect(sent.html).toContain("&lt;script&gt;");
  });

  it("email が見つからない場合は retriable:false の err を返す", async () => {
    lookup = new StubAccountEmailLookup(new Map());
    processor = new LeaderApplicationRejectedNotifyProcessor(mailSender, lookup);

    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retriable).toBe(false);
      expect(result.error.message).toContain("acc-1");
    }
    expect(mailSender.sentMessages).toHaveLength(0);
  });

  it("メール送信失敗時に err を返す", async () => {
    mailSender.nextResult = err({ message: "送信失敗", retriable: true });

    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retriable).toBe(true);
    }
  });
});
