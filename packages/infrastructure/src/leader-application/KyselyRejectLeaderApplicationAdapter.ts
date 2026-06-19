import type { LeaderApplication, LeaderApplicationRecruitmentType } from "@physifun/domain";
import { db } from "../database/kysely/client";
import { parsePgEnumArray } from "../database/kysely/pgArray";
import { reconstructLeaderApplication } from "./reconstructLeaderApplication";

/**
 * Kysely ベースの RejectLeaderApplicationPort 実装（Prisma 版からの移行 / #222）
 *
 * `PrismaRejectLeaderApplicationAdapter` と同一 API の drop-in。
 * 却下処理を単一トランザクションで実行する（Prisma の batched `$transaction([...])` 相当）。
 *
 * NOTE: 循環依存 (infrastructure → application) を避けるため、
 * Port インターフェースを直接 import せず、構造的部分型で適合する。
 */
export class KyselyRejectLeaderApplicationAdapter {
  async findApplicationById(id: string): Promise<LeaderApplication | null> {
    const row = await db
      .selectFrom("leader_applications")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    // pg はネイティブ enum 配列を文字列で返すため、reconstruct へ渡す前に配列化する。
    return reconstructLeaderApplication({
      ...row,
      recruitmentTypes: parsePgEnumArray(
        row.recruitmentTypes
      ) as LeaderApplicationRecruitmentType[],
    });
  }

  async executeRejectionInTransaction(params: {
    application: LeaderApplication;
    outboxMessage: { id: string; type: string; payload: unknown };
  }): Promise<void> {
    // reject() 実行後の application には reviewedAt が設定されている。
    // 型上は Date | null のため、updatedAt（NOT NULL）用にフォールバックを用意する。
    const reviewedAt = params.application.reviewedAt ?? new Date();

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("leader_applications")
        .set({
          status: "REJECTED",
          reviewerNote: params.application.reviewerNote,
          reviewedAt: params.application.reviewedAt,
          // Prisma の @updatedAt 相当
          updatedAt: reviewedAt,
        })
        .where("id", "=", params.application.id.toString())
        .execute();

      await trx
        .insertInto("leader_application_outbox_messages")
        .values({
          id: params.outboxMessage.id,
          type: params.outboxMessage.type,
          payload: params.outboxMessage.payload,
        })
        .execute();
    });
  }
}
