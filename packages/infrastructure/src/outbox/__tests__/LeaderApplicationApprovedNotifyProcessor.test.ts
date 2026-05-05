import { describe, it, expect, beforeEach } from "@jest/globals";
import { err } from "@physifun/domain";
import { NoopMailSender } from "../../mail/NoopMailSender";
import {
  LeaderApplicationApprovedNotifyProcessor,
  LEADER_APPLICATION_APPROVED_NOTIFY_TYPE,
  type LeaderApplicationApprovedNotifyPayload,
} from "../processors/LeaderApplicationApprovedNotifyProcessor";
import type { OutboxMessage } from "../types";

describe("LeaderApplicationApprovedNotifyProcessor", () => {
  let mailSender: NoopMailSender;
  let processor: LeaderApplicationApprovedNotifyProcessor;
  const baseUrl = "https://app.physifun.com";

  const makeMessage = (
    overrides?: Partial<LeaderApplicationApprovedNotifyPayload>
  ): OutboxMessage<LeaderApplicationApprovedNotifyPayload> => ({
    id: "msg-1",
    type: LEADER_APPLICATION_APPROVED_NOTIFY_TYPE,
    payload: {
      applicationId: "app-1",
      accountId: "acc-1",
      email: "leader@example.com",
      projectId: "proj-1",
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
    processor = new LeaderApplicationApprovedNotifyProcessor(mailSender, baseUrl);
  });

  it("type は approved.notify_applicant", () => {
    expect(processor.type).toBe("approved.notify_applicant");
  });

  it("payload の email 宛に送信する", async () => {
    const result = await processor.process(makeMessage({ email: "winner@example.com" }));

    expect(result.ok).toBe(true);
    expect(mailSender.sentMessages).toHaveLength(1);
    expect(mailSender.sentMessages[0].to).toBe("winner@example.com");
  });

  it("projectId 付き payload では /my/projects/[id] への CTA を含む（Issue #192 PR5）", async () => {
    await processor.process(makeMessage({ projectId: "proj-xyz" }));

    const sent = mailSender.sentMessages[0];
    expect(sent.text).toContain("https://app.physifun.com/my/projects/proj-xyz");
    expect(sent.html).toContain("https://app.physifun.com/my/projects/proj-xyz");
  });

  it("projectId 無し payload（旧メッセージ後方互換）ではログイン URL を含む", async () => {
    await processor.process(makeMessage({ projectId: undefined }));

    const sent = mailSender.sentMessages[0];
    expect(sent.text).toContain("https://app.physifun.com/login");
    expect(sent.html).toContain("https://app.physifun.com/login");
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
