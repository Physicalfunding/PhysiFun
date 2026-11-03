import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { KyselyLeaderApplicationQueryService } from "../../src/leader-application/KyselyLeaderApplicationQueryService";
import { db, insertRow, resetDatabase } from "../helpers/db";

/**
 * KyselyLeaderApplicationQueryService の本人向け `findStatusByAccountId` の integration test（#373）
 *
 * - ロール（ネイティブ enum 配列）からリーダーかどうかを判定できること
 * - 再応募で応募が複数あるとき、`submittedAt` が一番新しい応募を返すこと
 * - 引数のアカウント ID だけで絞り、他人の応募を返さないこと
 */
describe("KyselyLeaderApplicationQueryService (my) integration", () => {
  const service = new KyselyLeaderApplicationQueryService();

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.destroy();
  });

  async function seedAccount(opts: {
    email: string;
    roles: ("SUPPORTER" | "LEADER")[];
  }): Promise<string> {
    const account = await insertRow("accounts", {
      email: opts.email,
      displayName: "応募者",
      status: "ACTIVE",
      roles: opts.roles,
    });
    return account.id;
  }

  async function seedApplication(
    accountId: string,
    opts: {
      projectTitle: string;
      submittedAt: Date;
      status?: "PENDING" | "APPROVED" | "REJECTED";
      reviewerNote?: string | null;
    }
  ): Promise<string> {
    const application = await insertRow("leader_applications", {
      accountId,
      status: opts.status ?? "PENDING",
      projectTitle: opts.projectTitle,
      projectSummary: `${opts.projectTitle}の概要`,
      projectStory: "ストーリー",
      projectCategory: "EVENT",
      prefectureCode: "13",
      experienceOffered: "地域貢献の経験",
      submittedAt: opts.submittedAt,
      reviewerNote: opts.reviewerNote ?? null,
      reviewedAt: opts.status && opts.status !== "PENDING" ? new Date() : null,
    });
    return application.id;
  }

  it("リーダーかどうかと、アカウントのメールアドレスを返す", async () => {
    const supporterId = await seedAccount({
      email: "supporter@example.com",
      roles: ["SUPPORTER"],
    });
    const leaderId = await seedAccount({
      email: "leader@example.com",
      roles: ["SUPPORTER", "LEADER"],
    });

    const supporter = await service.findStatusByAccountId(supporterId);
    expect(supporter).toMatchObject({ isLeader: false, email: "supporter@example.com" });

    const leader = await service.findStatusByAccountId(leaderId);
    expect(leader).toMatchObject({ isLeader: true, email: "leader@example.com" });
  });

  it("応募が複数あるアカウントでは、submittedAt が一番新しい応募を返す", async () => {
    const accountId = await seedAccount({ email: "reapply@example.com", roles: ["SUPPORTER"] });
    // 新しい応募を先に入れ、挿入順ではなく submittedAt で選んでいることを確かめる
    const latestId = await seedApplication(accountId, {
      projectTitle: "再応募のプロジェクト",
      submittedAt: new Date("2026-11-02T00:00:00Z"),
    });
    await seedApplication(accountId, {
      projectTitle: "最初のプロジェクト",
      submittedAt: new Date("2026-10-01T00:00:00Z"),
      status: "REJECTED",
      reviewerNote: "活動内容をもう少し具体的に",
    });

    const result = await service.findStatusByAccountId(accountId);

    expect(result?.latestApplication).toEqual({
      id: latestId,
      status: "PENDING",
      projectTitle: "再応募のプロジェクト",
      projectSummary: "再応募のプロジェクトの概要",
      projectCategory: "EVENT",
      submittedAt: new Date("2026-11-02T00:00:00Z"),
      reviewerNote: null,
    });
  });

  it("他人の応募は返さない", async () => {
    const myId = await seedAccount({ email: "me@example.com", roles: ["SUPPORTER"] });
    const otherId = await seedAccount({ email: "other@example.com", roles: ["SUPPORTER"] });
    const myApplicationId = await seedApplication(myId, {
      projectTitle: "自分のプロジェクト",
      submittedAt: new Date("2026-10-01T00:00:00Z"),
    });
    // 他人の応募のほうが新しい
    await seedApplication(otherId, {
      projectTitle: "他人のプロジェクト",
      submittedAt: new Date("2026-11-01T00:00:00Z"),
    });

    const result = await service.findStatusByAccountId(myId);

    expect(result?.email).toBe("me@example.com");
    expect(result?.latestApplication?.id).toBe(myApplicationId);
    expect(result?.latestApplication?.projectTitle).toBe("自分のプロジェクト");
  });

  it("応募が無いアカウントでは latestApplication が null になる", async () => {
    const accountId = await seedAccount({ email: "no-app@example.com", roles: ["SUPPORTER"] });
    // 他人の応募があっても拾わない
    const otherId = await seedAccount({ email: "other@example.com", roles: ["SUPPORTER"] });
    await seedApplication(otherId, {
      projectTitle: "他人のプロジェクト",
      submittedAt: new Date("2026-11-01T00:00:00Z"),
    });

    const result = await service.findStatusByAccountId(accountId);

    expect(result).toEqual({
      isLeader: false,
      email: "no-app@example.com",
      latestApplication: null,
    });
  });

  it("却下された応募では、却下の理由（reviewerNote）を返す", async () => {
    const accountId = await seedAccount({ email: "rejected@example.com", roles: ["SUPPORTER"] });
    await seedApplication(accountId, {
      projectTitle: "却下されたプロジェクト",
      submittedAt: new Date("2026-10-01T00:00:00Z"),
      status: "REJECTED",
      reviewerNote: "活動場所と日程を具体的に書いてください",
    });

    const result = await service.findStatusByAccountId(accountId);

    expect(result?.latestApplication?.status).toBe("REJECTED");
    expect(result?.latestApplication?.reviewerNote).toBe("活動場所と日程を具体的に書いてください");
  });

  it("アカウントが無ければ null を返す", async () => {
    const result = await service.findStatusByAccountId("00000000-0000-4000-8000-000000000000");

    expect(result).toBeNull();
  });
});
