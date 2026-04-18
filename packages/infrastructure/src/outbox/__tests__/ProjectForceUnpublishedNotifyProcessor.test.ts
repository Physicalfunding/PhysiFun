import { describe, it, expect, beforeEach } from "@jest/globals";
import { err } from "@physifun/domain";
import { NoopMailSender } from "../../mail/NoopMailSender";
import {
  ProjectForceUnpublishedNotifyProcessor,
  PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE,
  type ProjectForceUnpublishedPayload,
} from "../processors/ProjectForceUnpublishedNotifyProcessor";
import type { OutboxMessage } from "../types";
import { StubAccountEmailLookup } from "./helpers";

describe("ProjectForceUnpublishedNotifyProcessor", () => {
  let mailSender: NoopMailSender;
  let lookup: StubAccountEmailLookup;
  let processor: ProjectForceUnpublishedNotifyProcessor;
  const baseUrl = "https://physifun.com";

  const makeMessage = (
    overrides?: Partial<ProjectForceUnpublishedPayload>
  ): OutboxMessage<ProjectForceUnpublishedPayload> => ({
    id: "msg-1",
    type: PROJECT_FORCE_UNPUBLISHED_NOTIFY_TYPE,
    payload: {
      projectId: "project-1",
      projectTitle: "テストプロジェクト",
      leaderAccountId: "leader-1",
      reviewerId: "reviewer-1",
      reviewerNote: "規約違反が確認されました。",
      unpublishedAt: "2026-04-17T00:00:00.000Z",
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
    lookup = new StubAccountEmailLookup();
    lookup.set("leader-1", "leader@example.com");
    processor = new ProjectForceUnpublishedNotifyProcessor(mailSender, lookup, baseUrl);
  });

  it("type は project_force_unpublished.notify", () => {
    expect(processor.type).toBe("project_force_unpublished.notify");
  });

  it("リーダーのメールアドレスに送信する", async () => {
    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(true);
    expect(mailSender.sentMessages[0].to).toBe("leader@example.com");
  });

  it("本文に非公開理由を含む", async () => {
    await processor.process(makeMessage({ reviewerNote: "不適切な内容が含まれています" }));

    const sent = mailSender.sentMessages[0];
    expect(sent.text).toContain("不適切な内容が含まれています");
    expect(sent.html).toContain("不適切な内容が含まれています");
  });

  it("本文にプロジェクト URL を含む", async () => {
    await processor.process(makeMessage({ projectId: "proj-abc" }));

    const sent = mailSender.sentMessages[0];
    expect(sent.text).toContain("https://physifun.com/my/projects/proj-abc");
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
