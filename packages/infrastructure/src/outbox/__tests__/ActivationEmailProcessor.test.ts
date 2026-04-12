import { describe, it, expect, beforeEach } from "@jest/globals";
import { err } from "@physifun/domain";
import { NoopMailSender } from "../../mail/NoopMailSender";
import {
  ActivationEmailProcessor,
  ACTIVATION_EMAIL_TYPE,
  type ActivationEmailPayload,
} from "../processors/ActivationEmailProcessor";
import type { OutboxMessage } from "../types";

describe("ActivationEmailProcessor", () => {
  let mailSender: NoopMailSender;
  let processor: ActivationEmailProcessor;
  const baseUrl = "https://physifun.com";

  const makeMessage = (
    overrides?: Partial<ActivationEmailPayload>
  ): OutboxMessage<ActivationEmailPayload> => ({
    id: "msg-1",
    type: ACTIVATION_EMAIL_TYPE,
    payload: {
      accountId: "account-1",
      email: "leader@example.com",
      displayName: "テストリーダー",
      activationToken: "token-abc-123",
      ...overrides,
    },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    sentAt: null,
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
  });

  beforeEach(() => {
    mailSender = new NoopMailSender();
    processor = new ActivationEmailProcessor(mailSender, baseUrl);
  });

  it("type は ACTIVATION_EMAIL", () => {
    expect(processor.type).toBe("ACTIVATION_EMAIL");
  });

  it("正しい宛先にメールを送信する", async () => {
    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(true);
    expect(mailSender.sentMessages).toHaveLength(1);
    expect(mailSender.sentMessages[0].to).toBe("leader@example.com");
  });

  it("件名に PhysiFun を含む", async () => {
    await processor.process(makeMessage());

    expect(mailSender.sentMessages[0].subject).toContain("PhysiFun");
  });

  it("本文に有効化 URL を含む", async () => {
    await processor.process(makeMessage());

    const sent = mailSender.sentMessages[0];
    const expectedUrl = "https://physifun.com/activate?token=token-abc-123";
    expect(sent.text).toContain(expectedUrl);
    expect(sent.html).toContain(expectedUrl);
  });

  it("本文に displayName を含む", async () => {
    await processor.process(makeMessage({ displayName: "山田太郎" }));

    const sent = mailSender.sentMessages[0];
    expect(sent.text).toContain("山田太郎");
  });

  it("メール送信失敗時に err を返す", async () => {
    mailSender.nextResult = err({
      message: "送信失敗",
      retriable: true,
    });

    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("送信失敗");
      expect(result.error.retriable).toBe(true);
    }
  });

  it("永続的失敗は retriable: false で伝播する", async () => {
    mailSender.nextResult = err({
      message: "宛先不正",
      retriable: false,
    });

    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retriable).toBe(false);
    }
  });
});
