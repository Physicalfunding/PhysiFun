import type { LeaderApplicationRecruitmentType, ProjectPhase } from "@physifun/domain";
import type { Insertable } from "kysely";
import { db } from "../database/kysely/client";
import type { AccountsTable, LeaderApplicationsTable, Role } from "../database/kysely/types";

/**
 * SubmitLeaderApplicationPort で用いるアカウントの最小表現
 *
 * application 層の AccountRow と同一構造。循環依存回避のためここで再定義する。
 */
export interface AccountRow {
  readonly id: string;
  readonly email: string;
  readonly status: "PENDING_EMAIL_CONFIRMATION" | "ACTIVE";
}

/**
 * SubmitLeaderApplicationUseCase のトランザクション内で作成する
 * Account / LeaderApplication / LeaderApplicationOutboxMessage のパラメータ型
 */
interface CreateAccountParams {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  /** 電話番号（任意、〜20 文字、Issue #192） */
  readonly phoneNumber: string | null;
  readonly status: "PENDING_EMAIL_CONFIRMATION" | "ACTIVE";
  readonly roles: readonly ("SUPPORTER" | "LEADER" | "ADMIN")[];
  readonly activationToken: string;
  readonly activationTokenExp: Date;
}

interface CreateLeaderApplicationParams {
  readonly id: string;
  readonly accountId: string;
  readonly status: "PENDING";
  readonly projectTitle: string;
  readonly projectSummary: string;
  readonly projectStory: string;
  readonly projectCategory: string;
  readonly prefectureCode: string;
  readonly municipality: string | null;
  readonly activityContent: string | null;
  readonly snsLinks: {
    x: string | null;
    instagram: string | null;
    facebook: string | null;
    website: string | null;
  } | null;

  // Issue #192 PR3 拡張
  readonly phoneNumber: string | null;
  readonly progress: ProjectPhase;
  readonly recruitmentTypes: readonly LeaderApplicationRecruitmentType[];
  readonly eventLocation: string | null;
  readonly eventPeriod: string | null;
  readonly recruitCount: number | null;
  readonly skillItemNeeds: string | null;
  readonly skillItemDeadline: string | null;
  readonly timeReturn: string | null;
  readonly skillItemReturn: string | null;
  /** Issue #192 PR #198 review M1 で NOT NULL 化 */
  readonly experienceOffered: string;

  readonly submittedAt: Date;
}

interface CreateOutboxMessageParams {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
}

/**
 * Kysely ベースの SubmitLeaderApplicationPort 実装（Prisma 版からの移行 / #222）
 *
 * `PrismaSubmitLeaderApplicationAdapter` と同一 API の drop-in。
 * application 層の SubmitLeaderApplicationPort に構造的部分型で適合する。
 *
 * executeInTransaction は Account + LeaderApplication + LeaderApplicationOutboxMessage を
 * 単一トランザクションで INSERT する（Prisma の batched `$transaction([...])` 相当）。
 *
 * NOTE: 循環依存 (infrastructure → application) を避けるため、
 * Port インターフェースを直接 import せず、構造的部分型で適合する。
 */
export class KyselySubmitLeaderApplicationAdapter {
  async findAccountByEmail(email: string): Promise<AccountRow | null> {
    const row = await db
      .selectFrom("accounts")
      .select(["id", "email", "status"])
      .where("email", "=", email)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      status: row.status as AccountRow["status"],
    };
  }

  async executeInTransaction(params: {
    account: CreateAccountParams;
    leaderApplication: CreateLeaderApplicationParams;
    outboxMessage: CreateOutboxMessageParams;
  }): Promise<void> {
    const { account, leaderApplication, outboxMessage } = params;

    // Prisma の `@updatedAt` 相当: updatedAt は DB DEFAULT を持たないため明示的に設定する
    // （createdAt は DB DEFAULT(now()) があるため省略し、Prisma create と同じ挙動にする）。
    const now = new Date();

    await db.transaction().execute(async (trx) => {
      // FK 制約（leader_applications.accountId → accounts.id）のため accounts を先に INSERT する。
      await trx.insertInto("accounts").values(toAccountInsert(account, now)).execute();
      await trx
        .insertInto("leader_applications")
        .values(toLeaderApplicationInsert(leaderApplication, now))
        .execute();
      await trx
        .insertInto("leader_application_outbox_messages")
        .values({
          id: outboxMessage.id,
          type: outboxMessage.type,
          payload: outboxMessage.payload,
        })
        .execute();
    });
  }
}

// ==================== マッピングヘルパー ====================

/** Account 作成パラメータ → accounts INSERT 値 */
function toAccountInsert(account: CreateAccountParams, now: Date): Insertable<AccountsTable> {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    phoneNumber: account.phoneNumber,
    status: account.status,
    // roles は Role[] のネイティブ enum 配列。pg が JS 配列を array リテラルへ直列化する。
    roles: [...account.roles] as Role[],
    activationToken: account.activationToken,
    activationTokenExp: account.activationTokenExp,
    updatedAt: now,
  };
}

/** LeaderApplication 作成パラメータ → leader_applications INSERT 値 */
function toLeaderApplicationInsert(
  app: CreateLeaderApplicationParams,
  now: Date
): Insertable<LeaderApplicationsTable> {
  return {
    id: app.id,
    accountId: app.accountId,
    status: app.status,
    projectTitle: app.projectTitle,
    projectSummary: app.projectSummary,
    projectStory: app.projectStory,
    projectCategory: app.projectCategory,
    prefectureCode: app.prefectureCode,
    municipality: app.municipality,
    activityContent: app.activityContent,
    // jsonb: JS オブジェクトを渡せば pg が直列化する。null は SQL NULL。
    snsLinks: app.snsLinks,
    phoneNumber: app.phoneNumber,
    progress: app.progress,
    // recruitmentTypes は LeaderApplicationRecruitmentType[] のネイティブ enum 配列。
    recruitmentTypes: [...app.recruitmentTypes],
    eventLocation: app.eventLocation,
    eventPeriod: app.eventPeriod,
    recruitCount: app.recruitCount,
    skillItemNeeds: app.skillItemNeeds,
    skillItemDeadline: app.skillItemDeadline,
    timeReturn: app.timeReturn,
    skillItemReturn: app.skillItemReturn,
    experienceOffered: app.experienceOffered,
    submittedAt: app.submittedAt,
    updatedAt: now,
  };
}
