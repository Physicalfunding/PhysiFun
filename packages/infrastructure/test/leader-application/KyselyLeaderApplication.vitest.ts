import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MaxProjectsReachedError } from "@physifun/application";
import { KyselyLeaderApplicationQueryService } from "../../src/leader-application/KyselyLeaderApplicationQueryService";
import { KyselySubmitLeaderApplicationAdapter } from "../../src/leader-application/KyselySubmitLeaderApplicationAdapter";
import { KyselyApproveLeaderApplicationAdapter } from "../../src/leader-application/KyselyApproveLeaderApplicationAdapter";
import { KyselyRejectLeaderApplicationAdapter } from "../../src/leader-application/KyselyRejectLeaderApplicationAdapter";
import { reconstructProject } from "../../src/project/reconstructProject";
import { db } from "../../src/database/kysely/client";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * Kysely 版 leader-application 実装の integration test（#222）
 *
 * - 検証対象は Kysely 実装。シードは Kysely の Submit アダプタ（書き込みパス自体の検証も兼ねる）と
 *   一部 Prisma ヘルパーで行う。
 * - 実 PostgreSQL（Testcontainers）に対して、ネイティブ enum 配列（roles / recruitmentTypes）の
 *   読み書き・jsonb（snsLinks）・トランザクション境界が Prisma 版と同じ結果になることを確認する。
 */
describe("Kysely LeaderApplication 実装 integration", () => {
  const prisma = getTestPrisma();
  const queryService = new KyselyLeaderApplicationQueryService();
  const submitAdapter = new KyselySubmitLeaderApplicationAdapter();
  const approveAdapter = new KyselyApproveLeaderApplicationAdapter();
  const rejectAdapter = new KyselyRejectLeaderApplicationAdapter();

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await db.destroy();
    await disconnectTestPrisma();
  });

  type SubmitParams = Parameters<KyselySubmitLeaderApplicationAdapter["executeInTransaction"]>[0];

  /** 妥当な Submit パラメータ一式を生成する（必要箇所だけ上書き可能） */
  function makeSubmitParams(opts?: {
    email?: string;
    recruitmentTypes?: ("TIME" | "SKILL_ITEM")[];
    snsLinks?: SubmitParams["leaderApplication"]["snsLinks"];
    submittedAt?: Date;
    projectTitle?: string;
  }): SubmitParams {
    const accountId = randomUUID();
    const applicationId = randomUUID();
    const email = opts?.email ?? `applicant-${randomUUID()}@example.com`;
    return {
      account: {
        id: accountId,
        email,
        displayName: "応募者太郎",
        phoneNumber: "090-1234-5678",
        status: "PENDING_EMAIL_CONFIRMATION",
        roles: ["SUPPORTER"],
        activationToken: randomUUID().replace(/-/g, ""),
        activationTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      leaderApplication: {
        id: applicationId,
        accountId,
        status: "PENDING",
        projectTitle: opts?.projectTitle ?? "地域清掃プロジェクト",
        projectSummary: "プロジェクト概要",
        projectStory: "プロジェクトストーリー",
        projectCategory: "COMMUNITY",
        prefectureCode: "13",
        municipality: "渋谷区",
        activityContent: "活動内容の説明",
        snsLinks: opts?.snsLinks ?? null,
        phoneNumber: "090-1234-5678",
        progress: "PLANNING",
        recruitmentTypes: opts?.recruitmentTypes ?? ["TIME"],
        eventLocation: "渋谷区民会館",
        eventPeriod: "2026 年夏",
        recruitCount: 5,
        skillItemNeeds: null,
        skillItemDeadline: null,
        timeReturn: "活動後に感謝状を贈呈",
        skillItemReturn: null,
        experienceOffered: "地域貢献の経験",
        submittedAt: opts?.submittedAt ?? new Date(),
      },
      outboxMessage: {
        id: randomUUID(),
        type: "ACTIVATION_EMAIL",
        payload: { accountId, email },
      },
    };
  }

  describe("Submit executeInTransaction（enum 配列書き込み + jsonb + トランザクション）", () => {
    it("account / leader_application / outbox を 1 tx で作成し、enum 配列と jsonb を永続化する", async () => {
      const params = makeSubmitParams({
        recruitmentTypes: ["TIME", "SKILL_ITEM"],
        snsLinks: { x: "https://x.com/foo", instagram: null, facebook: null, website: null },
      });

      await submitAdapter.executeInTransaction(params);

      // ネイティブ enum 配列（roles / recruitmentTypes）は ::text[] へキャストして
      // 実際に配列として格納されていることを直接確認する（pg の text[] パーサで解析させる）。
      const accountRow = await db
        .selectFrom("accounts")
        .select(["status"])
        .select((eb) => sql<string[]>`${eb.ref("roles")}::text[]`.as("roles"))
        .where("id", "=", params.account.id)
        .executeTakeFirstOrThrow();
      expect(accountRow.roles).toEqual(["SUPPORTER"]);
      expect(accountRow.status).toBe("PENDING_EMAIL_CONFIRMATION");

      const appRow = await db
        .selectFrom("leader_applications")
        .select(["snsLinks", "progress"])
        .select((eb) => sql<string[]>`${eb.ref("recruitmentTypes")}::text[]`.as("recruitmentTypes"))
        .where("id", "=", params.leaderApplication.id)
        .executeTakeFirstOrThrow();
      expect(appRow.recruitmentTypes).toEqual(["TIME", "SKILL_ITEM"]);
      expect(appRow.snsLinks).toEqual({
        x: "https://x.com/foo",
        instagram: null,
        facebook: null,
        website: null,
      });
      expect(appRow.progress).toBe("PLANNING");

      // QueryService 経由（parsePgEnumArray でパース済み）でも一致することを確認
      const detail = await queryService.findById(params.leaderApplication.id);
      expect(detail!.recruitmentTypes).toEqual(["TIME", "SKILL_ITEM"]);

      // outbox 行が同一 tx で作成されている
      const outboxCount = await db
        .selectFrom("leader_application_outbox_messages")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("id", "=", params.outboxMessage.id)
        .executeTakeFirstOrThrow();
      expect(Number(outboxCount.count)).toBe(1);
    });

    it("snsLinks が null の場合は SQL NULL として保存される", async () => {
      const params = makeSubmitParams({ snsLinks: null });
      await submitAdapter.executeInTransaction(params);

      const row = await db
        .selectFrom("leader_applications")
        .select("snsLinks")
        .where("id", "=", params.leaderApplication.id)
        .executeTakeFirstOrThrow();
      expect(row.snsLinks).toBeNull();
    });

    it("findAccountByEmail は作成済みアカウントを返し、未存在では null", async () => {
      const params = makeSubmitParams({ email: "lookup@example.com" });
      await submitAdapter.executeInTransaction(params);

      const found = await submitAdapter.findAccountByEmail("lookup@example.com");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(params.account.id);
      expect(found!.status).toBe("PENDING_EMAIL_CONFIRMATION");

      const missing = await submitAdapter.findAccountByEmail("nobody@example.com");
      expect(missing).toBeNull();
    });
  });

  describe("findById（enum 配列 + jsonb 読み取り + account join）", () => {
    it("recruitmentTypes / snsLinks / progress を含む詳細を account join 付きで返す", async () => {
      const params = makeSubmitParams({
        recruitmentTypes: ["SKILL_ITEM"],
        snsLinks: {
          x: null,
          instagram: "https://instagram.com/bar",
          facebook: null,
          website: null,
        },
      });
      await submitAdapter.executeInTransaction(params);

      const detail = await queryService.findById(params.leaderApplication.id);
      expect(detail).not.toBeNull();
      expect(detail!.displayName).toBe("応募者太郎");
      expect(detail!.email).toBe(params.account.email);
      expect(detail!.recruitmentTypes).toEqual(["SKILL_ITEM"]);
      expect(detail!.snsLinks).toEqual({
        x: null,
        instagram: "https://instagram.com/bar",
        facebook: null,
        website: null,
      });
      expect(detail!.progress).toBe("PLANNING");
      expect(detail!.status).toBe("PENDING");
    });

    it("存在しない id では null", async () => {
      const result = await queryService.findById("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  describe("findMany（submittedAt DESC + status フィルタ + ページネーション + count）", () => {
    it("submittedAt DESC で account を join し、totalCount を返す", async () => {
      const older = makeSubmitParams({
        projectTitle: "古い応募",
        submittedAt: new Date("2026-01-01T00:00:00Z"),
      });
      const newer = makeSubmitParams({
        projectTitle: "新しい応募",
        submittedAt: new Date("2026-02-01T00:00:00Z"),
      });
      await submitAdapter.executeInTransaction(older);
      await submitAdapter.executeInTransaction(newer);

      const result = await queryService.findMany({ page: 1, perPage: 20 });
      expect(result.totalCount).toBe(2);
      expect(result.items.map((i) => i.projectTitle)).toEqual(["新しい応募", "古い応募"]);
      expect(result.items[0].displayName).toBe("応募者太郎");
      expect(result.items[0].email).toBe(newer.account.email);
    });

    it("status フィルタで絞り込み、件数も同条件で数える", async () => {
      const pending = makeSubmitParams();
      const toApprove = makeSubmitParams();
      await submitAdapter.executeInTransaction(pending);
      await submitAdapter.executeInTransaction(toApprove);

      // 1 件を承認して APPROVED にする
      const application = await approveAdapter.findApplicationById(toApprove.leaderApplication.id);
      await approveAdapter.executeApproval({
        application: application!,
        accountId: toApprove.account.id,
        newRoles: ["SUPPORTER", "LEADER"],
        reviewedAt: new Date(),
        project: buildInitialProject(toApprove.account.id),
        maxProjectsPerLeader: 3,
        outboxMessage: {
          id: randomUUID(),
          type: "approved.notify_applicant",
          payload: {},
        },
      });

      const pendingResult = await queryService.findMany({
        status: "PENDING",
        page: 1,
        perPage: 20,
      });
      expect(pendingResult.totalCount).toBe(1);
      expect(pendingResult.items[0].id).toBe(pending.leaderApplication.id);

      const approvedResult = await queryService.findMany({
        status: "APPROVED",
        page: 1,
        perPage: 20,
      });
      expect(approvedResult.totalCount).toBe(1);
      expect(approvedResult.items[0].id).toBe(toApprove.leaderApplication.id);
    });

    it("perPage / page でページングする", async () => {
      for (let i = 0; i < 3; i++) {
        await submitAdapter.executeInTransaction(
          makeSubmitParams({
            projectTitle: `応募 ${i}`,
            submittedAt: new Date(`2026-03-0${i + 1}T00:00:00Z`),
          })
        );
      }

      const page1 = await queryService.findMany({ page: 1, perPage: 2 });
      expect(page1.totalCount).toBe(3);
      expect(page1.items).toHaveLength(2);
      expect(page1.items.map((i) => i.projectTitle)).toEqual(["応募 2", "応募 1"]);

      const page2 = await queryService.findMany({ page: 2, perPage: 2 });
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0].projectTitle).toBe("応募 0");
    });
  });

  describe("countByStatus", () => {
    it("status ごとの件数を返す", async () => {
      await submitAdapter.executeInTransaction(makeSubmitParams());
      await submitAdapter.executeInTransaction(makeSubmitParams());

      expect(await queryService.countByStatus("PENDING")).toBe(2);
      expect(await queryService.countByStatus("APPROVED")).toBe(0);
      expect(await queryService.countByStatus("REJECTED")).toBe(0);
    });
  });

  describe("Approve executeApproval（トランザクション + 件数上限 + reconstruct）", () => {
    it("LA を APPROVED にし、roles に LEADER を追加し、Project と outbox を作成する", async () => {
      const params = makeSubmitParams({ recruitmentTypes: ["TIME", "SKILL_ITEM"] });
      await submitAdapter.executeInTransaction(params);

      // findApplicationById（reconstruct）で enum 配列を含む集約を復元できる
      const application = await approveAdapter.findApplicationById(params.leaderApplication.id);
      expect(application).not.toBeNull();
      expect(application!.id.toString()).toBe(params.leaderApplication.id);
      expect(application!.snapshot.recruitmentTypes).toEqual(["TIME", "SKILL_ITEM"]);

      const projectId = randomUUID();
      await approveAdapter.executeApproval({
        application: application!,
        accountId: params.account.id,
        newRoles: ["SUPPORTER", "LEADER"],
        reviewedAt: new Date(),
        project: buildInitialProject(params.account.id, projectId),
        maxProjectsPerLeader: 3,
        outboxMessage: {
          id: randomUUID(),
          type: "approved.notify_applicant",
          payload: { applicationId: params.leaderApplication.id },
        },
      });

      const appRow = await db
        .selectFrom("leader_applications")
        .select(["status", "reviewedAt"])
        .where("id", "=", params.leaderApplication.id)
        .executeTakeFirstOrThrow();
      expect(appRow.status).toBe("APPROVED");
      expect(appRow.reviewedAt).not.toBeNull();

      // roles（enum 配列）は findAccountById 経由でパース済み配列として検証する
      const account = await approveAdapter.findAccountById(params.account.id);
      expect(account!.roles).toEqual(["SUPPORTER", "LEADER"]);

      const projectRow = await db
        .selectFrom("projects")
        .select(["id", "ownerAccountId", "status"])
        .where("id", "=", projectId)
        .executeTakeFirstOrThrow();
      expect(projectRow.ownerAccountId).toBe(params.account.id);
      expect(projectRow.status).toBe("DRAFT");

      const outboxCount = await db
        .selectFrom("leader_application_outbox_messages")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("type", "=", "approved.notify_applicant")
        .executeTakeFirstOrThrow();
      expect(Number(outboxCount.count)).toBe(1);
    });

    it("件数上限到達時は MaxProjectsReachedError を投げ、全操作をロールバックする", async () => {
      const params = makeSubmitParams();
      await submitAdapter.executeInTransaction(params);

      // 既存 Project を 1 件用意し、上限 1 で承認を試みる
      await db
        .insertInto("projects")
        .values({
          id: randomUUID(),
          ownerAccountId: params.account.id,
          title: "既存プロジェクト",
          status: "DRAFT",
          phase: "PLANNING",
          updatedAt: new Date(),
        })
        .execute();

      const application = await approveAdapter.findApplicationById(params.leaderApplication.id);
      await expect(
        approveAdapter.executeApproval({
          application: application!,
          accountId: params.account.id,
          newRoles: ["SUPPORTER", "LEADER"],
          reviewedAt: new Date(),
          project: buildInitialProject(params.account.id),
          maxProjectsPerLeader: 1,
          outboxMessage: { id: randomUUID(), type: "approved.notify_applicant", payload: {} },
        })
      ).rejects.toBeInstanceOf(MaxProjectsReachedError);

      // ロールバック: LA は PENDING のまま、roles も未更新、outbox も未作成
      const appRow = await db
        .selectFrom("leader_applications")
        .select("status")
        .where("id", "=", params.leaderApplication.id)
        .executeTakeFirstOrThrow();
      expect(appRow.status).toBe("PENDING");

      // roles も未更新（findAccountById 経由でパース済み配列として検証）
      const account = await approveAdapter.findAccountById(params.account.id);
      expect(account!.roles).toEqual(["SUPPORTER"]);

      const outboxCount = await db
        .selectFrom("leader_application_outbox_messages")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("type", "=", "approved.notify_applicant")
        .executeTakeFirstOrThrow();
      expect(Number(outboxCount.count)).toBe(0);
    });
  });

  describe("Reject executeRejectionInTransaction", () => {
    it("LA を REJECTED にし、reviewerNote を保存し、outbox を作成する", async () => {
      const params = makeSubmitParams();
      await submitAdapter.executeInTransaction(params);

      const application = await rejectAdapter.findApplicationById(params.leaderApplication.id);
      const rejected = application!.reject({ reviewerNote: "要件を満たしていません" });
      expect(rejected.ok).toBe(true);

      await rejectAdapter.executeRejectionInTransaction({
        application: application!,
        outboxMessage: {
          id: randomUUID(),
          type: "rejected.notify_applicant",
          payload: { applicationId: params.leaderApplication.id },
        },
      });

      const appRow = await db
        .selectFrom("leader_applications")
        .select(["status", "reviewerNote", "reviewedAt"])
        .where("id", "=", params.leaderApplication.id)
        .executeTakeFirstOrThrow();
      expect(appRow.status).toBe("REJECTED");
      expect(appRow.reviewerNote).toBe("要件を満たしていません");
      expect(appRow.reviewedAt).not.toBeNull();

      const outboxCount = await db
        .selectFrom("leader_application_outbox_messages")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("type", "=", "rejected.notify_applicant")
        .executeTakeFirstOrThrow();
      expect(Number(outboxCount.count)).toBe(1);
    });
  });

  /** 承認時に作成する初期 Project（DRAFT）を組み立てる（UseCase のマッピング相当） */
  function buildInitialProject(ownerAccountId: string, id: string = randomUUID()) {
    return reconstructProject({
      id,
      ownerAccountId,
      title: "初期プロジェクト",
      coverImageUrl: null,
      category: "COMMUNITY",
      prefectureCode: "13",
      municipality: "渋谷区",
      phase: "PLANNING",
      status: "DRAFT",
      summary: "プロジェクト概要",
      story: "プロジェクトストーリー",
      leaderIntro: null,
      snsLinks: {},
      activityPlan: "活動内容の説明",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
});
