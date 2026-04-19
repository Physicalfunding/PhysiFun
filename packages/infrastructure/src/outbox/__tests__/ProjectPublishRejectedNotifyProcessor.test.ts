import { describe, it, expect, beforeEach } from "@jest/globals";
import { err } from "@physifun/domain";
import { NoopMailSender } from "../../mail/NoopMailSender";
import {
  ProjectPublishRejectedNotifyProcessor,
  LEADER_PUBLISH_REJECTED_NOTIFY_TYPE,
  type ProjectPublishRejectedPayload,
} from "../processors/ProjectPublishRejectedNotifyProcessor";
import type { OutboxMessage } from "../types";
import { StubAccountEmailLookup } from "./helpers";

describe("ProjectPublishRejectedNotifyProcessor", () => {
  let mailSender: NoopMailSender;
  let lookup: StubAccountEmailLookup;
  let processor: ProjectPublishRejectedNotifyProcessor;
  const baseUrl = "https://physifun.com";

  const makeMessage = (
    overrides?: Partial<ProjectPublishRejectedPayload>
  ): OutboxMessage<ProjectPublishRejectedPayload> => ({
    id: "msg-1",
    type: LEADER_PUBLISH_REJECTED_NOTIFY_TYPE,
    payload: {
      projectId: "project-1",
      projectTitle: "テストプロジェクト",
      leaderAccountId: "leader-1",
      reviewerId: "reviewer-1",
      reviewerNote: "画像が不鮮明です。再アップロードしてください。",
      rejectedAt: "2026-04-17T00:00:00.000Z",
      ...overrides,
    },
    createdAt: new Date("2026-04-17T00:00:00Z"),
    sentAt: null,
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
    deadLetteredAt: null,
  });

  beforeEach(() => {
    mailSender = new NoopMailSender();
    lookup = new StubAccountEmailLookup();
    lookup.set("leader-1", "leader@example.com");
    processor = new ProjectPublishRejectedNotifyProcessor(mailSender, lookup, baseUrl);
  });

  it("type は project_publish_rejected.notify", () => {
    expect(processor.type).toBe("project_publish_rejected.notify");
  });

  it("リーダーのメールアドレスに送信する", async () => {
    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(true);
    expect(mailSender.sentMessages[0].to).toBe("leader@example.com");
  });

  it("本文に差戻理由を含む", async () => {
    await processor.process(makeMessage({ reviewerNote: "概要が短すぎます" }));

    const sent = mailSender.sentMessages[0];
    expect(sent.text).toContain("概要が短すぎます");
    expect(sent.html).toContain("概要が短すぎます");
  });

  it("HTML テンプレートでユーザー入力がエスケープされる", async () => {
    await processor.process(
      makeMessage({
        projectTitle: '<script>alert("xss")</script>',
        reviewerNote: '<img onerror="alert(1)" src=x>',
      })
    );

    const sent = mailSender.sentMessages[0];
    expect(sent.html).not.toContain("<script>");
    expect(sent.html).not.toContain("<img");
    expect(sent.html).toContain("&lt;script&gt;");
    expect(sent.html).toContain("&lt;img");
  });

  it("本文に編集 URL を含む", async () => {
    await processor.process(makeMessage({ projectId: "proj-abc" }));

    const sent = mailSender.sentMessages[0];
    expect(sent.text).toContain("https://physifun.com/my/projects/proj-abc/edit");
  });

  it("リーダーのメールが見つからない場合は retriable: false の err を返す", async () => {
    const result = await processor.process(makeMessage({ leaderAccountId: "unknown-id" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retriable).toBe(false);
    }
  });

  it("メール送信失敗時に err を返す", async () => {
    mailSender.nextResult = err({ message: "Rate limit", retriable: true });

    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retriable).toBe(true);
    }
  });
});
