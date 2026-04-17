import { describe, it, expect, beforeEach } from "@jest/globals";
import { err } from "@physifun/domain";
import { NoopMailSender } from "../../mail/NoopMailSender";
import {
  AdminPublishRequestNotifyProcessor,
  ADMIN_PUBLISH_REQUEST_NOTIFY_TYPE,
  type AdminPublishRequestNotifyPayload,
} from "../processors/AdminPublishRequestNotifyProcessor";
import type { OutboxMessage } from "../types";

describe("AdminPublishRequestNotifyProcessor", () => {
  let mailSender: NoopMailSender;
  let processor: AdminPublishRequestNotifyProcessor;
  const adminEmail = "admin@physifun.com";
  const baseUrl = "https://admin.physifun.com";

  const makeMessage = (
    overrides?: Partial<AdminPublishRequestNotifyPayload>
  ): OutboxMessage<AdminPublishRequestNotifyPayload> => ({
    id: "msg-1",
    type: ADMIN_PUBLISH_REQUEST_NOTIFY_TYPE,
    payload: {
      projectId: "project-1",
      projectTitle: "テストプロジェクト",
      leaderAccountId: "leader-1",
      requestedAt: "2026-04-17T00:00:00.000Z",
      ...overrides,
    },
    createdAt: new Date("2026-04-17T00:00:00Z"),
    sentAt: null,
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
  });

  beforeEach(() => {
    mailSender = new NoopMailSender();
    processor = new AdminPublishRequestNotifyProcessor(mailSender, adminEmail, baseUrl);
  });

  it("type は admin_publish_request.notify", () => {
    expect(processor.type).toBe("admin_publish_request.notify");
  });

  it("運営メールアドレスに送信する", async () => {
    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(true);
    expect(mailSender.sentMessages).toHaveLength(1);
    expect(mailSender.sentMessages[0].to).toBe(adminEmail);
  });

  it("件名にプロジェクト名を含む", async () => {
    await processor.process(makeMessage({ projectTitle: "環境保全プロジェクト" }));

    expect(mailSender.sentMessages[0].subject).toContain("環境保全プロジェクト");
  });

  it("本文に審査 URL を含む", async () => {
    await processor.process(makeMessage({ projectId: "proj-abc" }));

    const sent = mailSender.sentMessages[0];
    expect(sent.text).toContain("https://admin.physifun.com/projects/proj-abc");
    expect(sent.html).toContain("https://admin.physifun.com/projects/proj-abc");
  });

  it("メール送信失敗時に err を返す", async () => {
    mailSender.nextResult = err({ message: "送信失敗", retriable: true });

    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retriable).toBe(true);
    }
  });

  it("メール送信失敗 (retriable: false) 時に retriable: false の err を返す", async () => {
    mailSender.nextResult = err({ message: "無効な宛先", retriable: false });

    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retriable).toBe(false);
    }
  });
});
