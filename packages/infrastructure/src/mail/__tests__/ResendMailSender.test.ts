import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ResendMailSender } from "../ResendMailSender";
import type { MailMessage } from "../types";

// Resend SDK をモック
const mockSend = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

describe("ResendMailSender", () => {
  let sender: ResendMailSender;
  const testMessage: MailMessage = {
    to: "test@example.com",
    subject: "テスト件名",
    text: "テスト本文",
    html: "<p>テスト本文</p>",
  };

  beforeEach(() => {
    mockSend.mockReset();
    sender = new ResendMailSender({
      apiKey: "re_test_key",
      fromAddress: "noreply@physifun.com",
    });
  });

  it("正常送信時に ok を返す", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg_123" }, error: null });

    const result = await sender.send(testMessage);

    expect(result.ok).toBe(true);
    expect(mockSend).toHaveBeenCalledWith({
      from: "noreply@physifun.com",
      to: "test@example.com",
      subject: "テスト件名",
      text: "テスト本文",
      html: "<p>テスト本文</p>",
    });
  });

  it("Resend API エラー時に err を返す", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid email" },
    });

    const result = await sender.send(testMessage);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Invalid email");
      expect(result.error.retriable).toBe(false);
    }
  });

  it("rate limit エラーは retriable: true", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: "rate_limit_exceeded", message: "Too many requests" },
    });

    const result = await sender.send(testMessage);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retriable).toBe(true);
    }
  });

  it("ネットワークエラー (throw) は retriable: true", async () => {
    mockSend.mockRejectedValue(new Error("Network timeout"));

    const result = await sender.send(testMessage);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Network timeout");
      expect(result.error.retriable).toBe(true);
    }
  });
});
