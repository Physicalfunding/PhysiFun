import { describe, it, expect, beforeEach } from "@jest/globals";
import { err } from "@physifun/domain";
import { NoopMailSender } from "../../mail/NoopMailSender";
import {
  ProjectPublishApprovedNotifyProcessor,
  PROJECT_PUBLISH_APPROVED_NOTIFY_TYPE,
  type ProjectPublishApprovedPayload,
} from "../processors/ProjectPublishApprovedNotifyProcessor";
import type { OutboxMessage } from "../types";
import { StubAccountEmailLookup } from "./helpers";

describe("ProjectPublishApprovedNotifyProcessor", () => {
  let mailSender: NoopMailSender;
  let lookup: StubAccountEmailLookup;
  let processor: ProjectPublishApprovedNotifyProcessor;
  const baseUrl = "https://physifun.com";

  const makeMessage = (
    overrides?: Partial<ProjectPublishApprovedPayload>
  ): OutboxMessage<ProjectPublishApprovedPayload> => ({
    id: "msg-1",
    type: PROJECT_PUBLISH_APPROVED_NOTIFY_TYPE,
    payload: {
      projectId: "project-1",
      projectTitle: "テストプロジェクト",
      leaderAccountId: "leader-1",
      reviewerId: "reviewer-1",
      approvedAt: "2026-04-17T00:00:00.000Z",
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
    processor = new ProjectPublishApprovedNotifyProcessor(mailSender, lookup, baseUrl);
  });

  it("type は project_publish_approved.notify", () => {
    expect(processor.type).toBe("project_publish_approved.notify");
  });

  it("リーダーのメールアドレスに送信する", async () => {
    const result = await processor.process(makeMessage());

    expect(result.ok).toBe(true);
    expect(mailSender.sentMessages).toHaveLength(1);
    expect(mailSender.sentMessages[0].to).toBe("leader@example.com");
  });

  it("件名にプロジェクト名を含む", async () => {
    await processor.process(makeMessage({ projectTitle: "環境保全" }));

    expect(mailSender.sentMessages[0].subject).toContain("環境保全");
  });

  it("本文にプロジェクト URL を含む", async () => {
    await processor.process(makeMessage({ projectId: "proj-abc" }));

    const sent = mailSender.sentMessages[0];
    expect(sent.text).toContain("https://physifun.com/my/projects/proj-abc");
  });

  it("リーダーのメールが見つからない場合は retriable: false の err を返す", async () => {
    const result = await processor.process(
      makeMessage({ leaderAccountId: "unknown-id" })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retriable).toBe(false);
      expect(result.error.message).toContain("unknown-id");
    }
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
