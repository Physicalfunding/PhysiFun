import {
  AccountId,
  type ProjectId,
  type RecruitmentRepository,
  type RecruitmentSchedule,
  ScheduleDateConflictError,
  type SupportRecruitment,
  type SupportRecruitmentId,
} from "@physifun/domain";
import type { ProjectOwnerPort } from "@physifun/application";
import { sql, type Insertable, type Updateable } from "kysely";
import { DatabaseError } from "pg";
import { isUniqueConstraintError } from "../database/isUniqueConstraintError";
import { db } from "../database/kysely/client";
import type { RecruitmentSchedules, SupportRecruitments } from "../database/kysely/types";
import { reconstructRecruitment, reconstructRecruitmentSchedule } from "./reconstructRecruitment";

/**
 * Kysely ベースの SupportRecruitment 集約のリポジトリ
 *
 * domain の `RecruitmentRepository` と、所有者チェック用の `ProjectOwnerPort` を実装する
 * （募集のユースケース 6 本の port を、これ 1 つで満たす）。
 *
 * ## 開催日（`recruitment_schedules.date`）
 * `date` 型は、pg の既定の変換だと Node のタイムゾーンの 0 時の `Date` になり、タイムゾーンで日付がずれる。
 * 読むときは `to_char` で `"YYYY-MM-DD"` の文字列にし、書くときも文字列で渡す
 * （`::text` にしないのは、DB の `DateStyle` の設定で書式が変わるため）。
 *
 * ## 同時に削除されたとき
 * 募集を読んでから書くまでの間に、別のリクエストが募集・日程・プロジェクトを消すことがある。
 * そのときは例外にせず、何もせずに終える。どちらも「書いた直後に消された」のと同じ結果になるため。
 * - 更新・削除が 0 行だった
 * - 消えた募集への日程の追加・消えたプロジェクトへの募集の作成で、外部キー違反（`23503`）になった
 *   （外部キー違反は制約の名前で絞る。ほかの外部キー違反は、バグを隠さないよう例外のまま投げる）
 */
export class KyselyRecruitmentRepository implements RecruitmentRepository, ProjectOwnerPort {
  async findProjectOwner(projectId: ProjectId): Promise<AccountId | null> {
    const row = await db
      .selectFrom("projects")
      .select("ownerAccountId")
      .where("id", "=", projectId.toString())
      .executeTakeFirst();
    if (!row) return null;

    const accountIdResult = AccountId.from(row.ownerAccountId);
    if (!accountIdResult.ok) throw new Error(`Invalid AccountId: ${row.ownerAccountId}`);
    return accountIdResult.value;
  }

  async findById(id: SupportRecruitmentId): Promise<SupportRecruitment | null> {
    const row = await db
      .selectFrom("support_recruitments")
      .selectAll()
      .where("id", "=", id.toString())
      .executeTakeFirst();
    if (!row) return null;

    const schedules = await findSchedulesByRecruitmentIds([row.id]);
    return reconstructRecruitment(row, schedules.get(row.id) ?? []);
  }

  async findByProjectId(projectId: ProjectId): Promise<SupportRecruitment[]> {
    const rows = await db
      .selectFrom("support_recruitments")
      .selectAll()
      .where("projectId", "=", projectId.toString())
      .orderBy("createdAt", "asc")
      .orderBy("id", "asc")
      .execute();
    if (rows.length === 0) return [];

    const schedules = await findSchedulesByRecruitmentIds(rows.map((row) => row.id));
    return rows.map((row) => reconstructRecruitment(row, schedules.get(row.id) ?? []));
  }

  async create(recruitment: SupportRecruitment): Promise<void> {
    try {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto("support_recruitments")
          .values(toRecruitmentInsert(recruitment))
          .execute();
        if (recruitment.schedules.length > 0) {
          await trx
            .insertInto("recruitment_schedules")
            .values(recruitment.schedules.map(toScheduleInsert))
            .execute();
        }
      });
    } catch (e) {
      // プロジェクトが同時に削除された（クラスの説明の「同時に削除されたとき」）
      if (isForeignKeyViolationOf(e, "support_recruitments_projectId_fkey")) return;
      throw e;
    }
  }

  async update(recruitment: SupportRecruitment): Promise<void> {
    await db
      .updateTable("support_recruitments")
      .set({
        title: recruitment.title,
        description: recruitment.description,
        updatedAt: recruitment.updatedAt,
      })
      .where("id", "=", recruitment.id.toString())
      .execute();
  }

  async delete(id: SupportRecruitmentId): Promise<void> {
    await db.deleteFrom("support_recruitments").where("id", "=", id.toString()).execute();
  }

  async addSchedule(schedule: RecruitmentSchedule): Promise<void> {
    try {
      await db.insertInto("recruitment_schedules").values(toScheduleInsert(schedule)).execute();
    } catch (e) {
      // 同じ募集に同じ日付の日程が同時に追加された（unique: supportRecruitmentId + date）
      if (isUniqueConstraintError(e)) throw new ScheduleDateConflictError(schedule.date.toString());
      // 募集が同時に削除された（クラスの説明の「同時に削除されたとき」）
      if (isForeignKeyViolationOf(e, "recruitment_schedules_supportRecruitmentId_fkey")) return;
      throw e;
    }
  }

  async updateSchedule(schedule: RecruitmentSchedule): Promise<void> {
    try {
      await db
        .updateTable("recruitment_schedules")
        .set(toScheduleUpdate(schedule))
        .where("id", "=", schedule.id.toString())
        .where("supportRecruitmentId", "=", schedule.supportRecruitmentId.toString())
        .execute();
    } catch (e) {
      // 変更後の日付の日程が、同じ募集に同時に追加・変更された（unique: supportRecruitmentId + date）
      if (isUniqueConstraintError(e)) throw new ScheduleDateConflictError(schedule.date.toString());
      throw e;
    }
  }

  async removeSchedule(schedule: RecruitmentSchedule): Promise<void> {
    await db
      .deleteFrom("recruitment_schedules")
      .where("id", "=", schedule.id.toString())
      .where("supportRecruitmentId", "=", schedule.supportRecruitmentId.toString())
      .execute();
  }
}

// ==================== 読み込みヘルパー ====================

/** 募集 ID ごとの日程（並べ替えは `SupportRecruitment.reconstruct()` が行う） */
async function findSchedulesByRecruitmentIds(
  recruitmentIds: readonly string[]
): Promise<Map<string, RecruitmentSchedule[]>> {
  const rows = await db
    .selectFrom("recruitment_schedules")
    .select([
      "id",
      "supportRecruitmentId",
      sql<string>`to_char(${sql.ref("date")}, 'YYYY-MM-DD')`.as("date"),
      "startTime",
      "endTime",
      "capacityPerHour",
      "approvalMode",
      "createdAt",
      "updatedAt",
    ])
    .where("supportRecruitmentId", "in", recruitmentIds)
    .execute();

  const schedulesByRecruitmentId = new Map<string, RecruitmentSchedule[]>();
  for (const row of rows) {
    const schedules = schedulesByRecruitmentId.get(row.supportRecruitmentId) ?? [];
    schedules.push(reconstructRecruitmentSchedule(row));
    schedulesByRecruitmentId.set(row.supportRecruitmentId, schedules);
  }
  return schedulesByRecruitmentId;
}

// ==================== マッピングヘルパー ====================

function toRecruitmentInsert(r: SupportRecruitment): Insertable<SupportRecruitments> {
  return {
    id: r.id.toString(),
    projectId: r.projectId.toString(),
    type: r.type,
    title: r.title,
    description: r.description,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** 日程 → recruitment_schedules INSERT 値（`date` は "YYYY-MM-DD" の文字列で渡す） */
function toScheduleInsert(s: RecruitmentSchedule): Insertable<RecruitmentSchedules> {
  return {
    id: s.id.toString(),
    supportRecruitmentId: s.supportRecruitmentId.toString(),
    date: s.date.toString(),
    startTime: s.timeRange.start,
    endTime: s.timeRange.end,
    capacityPerHour: s.capacityPerHour.value,
    approvalMode: s.approvalMode,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/** 日程 → recruitment_schedules UPDATE 値（id / supportRecruitmentId / createdAt は更新しない） */
function toScheduleUpdate(s: RecruitmentSchedule): Updateable<RecruitmentSchedules> {
  return {
    date: s.date.toString(),
    startTime: s.timeRange.start,
    endTime: s.timeRange.end,
    capacityPerHour: s.capacityPerHour.value,
    approvalMode: s.approvalMode,
    updatedAt: s.updatedAt,
  };
}

/** 外部キー違反（SQLSTATE `23503`）で、違反した制約が `constraint` か */
function isForeignKeyViolationOf(error: unknown, constraint: string): boolean {
  return (
    error instanceof DatabaseError && error.code === "23503" && error.constraint === constraint
  );
}
