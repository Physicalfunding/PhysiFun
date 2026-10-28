import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AddScheduleUseCase,
  CreateRecruitmentUseCase,
  DeleteRecruitmentUseCase,
  RemoveScheduleUseCase,
  UpdateRecruitmentUseCase,
  UpdateScheduleUseCase,
} from "@physifun/application";
import {
  ApprovalMode,
  CapacityPerHour,
  ProjectId,
  RecruitmentSchedule,
  RecruitmentType,
  type Result,
  ScheduleDate,
  ScheduleDateConflictError,
  SupportRecruitment,
  SupportRecruitmentId,
  TimeRange,
} from "@physifun/domain";
import { KyselyRecruitmentRepository } from "../../src/recruitment/KyselyRecruitmentRepository";
import { db } from "../../src/database/kysely/client";
import { insertRow, resetDatabase } from "../helpers/db";

/**
 * Kysely 版 SupportRecruitment リポジトリの integration test（#217）
 *
 * - シードはテスト用ヘルパー（`helpers/db.ts`）で行い、検証対象は `KyselyRecruitmentRepository`。
 * - 実 PostgreSQL（Testcontainers）に対して、CRUD・日付の重複（`23505` → `ScheduleDateConflictError`）・
 *   JST の開催日の往復・同時に削除されたときの扱いを確認する。
 */
describe("KyselyRecruitmentRepository integration", () => {
  const repository = new KyselyRecruitmentRepository();

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe("findProjectOwner", () => {
    it("プロジェクトの所有者のアカウント ID を返す", async () => {
      const { leaderId, projectId } = await seedProject();

      const owner = await repository.findProjectOwner(projectId);

      expect(owner?.toString()).toBe(leaderId);
    });

    it("プロジェクトが無ければ null", async () => {
      const owner = await repository.findProjectOwner(MISSING_PROJECT_ID);

      expect(owner).toBeNull();
    });
  });

  describe("create / findById", () => {
    it("募集を日程ごと保存し、同じ内容で読み戻せる（日程は日付の古い順）", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      addScheduleTo(recruitment, "2099-01-12", { approvalMode: ApprovalMode.MANUAL });
      addScheduleTo(recruitment, "2099-01-10", { start: "09:00", end: "12:00", capacity: 3 });

      await repository.create(recruitment);
      const found = await repository.findById(recruitment.id);

      expect(found).not.toBeNull();
      expect(toPlain(found!)).toEqual(toPlain(recruitment));
      expect(found!.schedules.map((s) => s.date.toString())).toEqual(["2099-01-10", "2099-01-12"]);
    });

    it("日程の無い募集も保存できる", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);

      await repository.create(recruitment);
      const found = await repository.findById(recruitment.id);

      expect(toPlain(found!)).toEqual(toPlain(recruitment));
      expect(found!.schedules).toEqual([]);
    });

    it("無い ID では null", async () => {
      const found = await repository.findById(MISSING_RECRUITMENT_ID);

      expect(found).toBeNull();
    });
  });

  describe("findByProjectId", () => {
    it("プロジェクトの募集を作成日時の古い順に、それぞれの日程ごと返す（他のプロジェクトの募集は含まない）", async () => {
      const { projectId } = await seedProject();
      const { projectId: otherProjectId } = await seedProject("other@example.com");

      const newer = newRecruitment(projectId, {
        title: "新しい募集",
        createdAt: new Date("2026-02-01T00:00:00Z"),
      });
      addScheduleTo(newer, "2099-03-01");
      const older = newRecruitment(projectId, {
        title: "古い募集",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      });
      addScheduleTo(older, "2099-03-01");
      addScheduleTo(older, "2099-03-02");
      const others = newRecruitment(otherProjectId, { title: "他のプロジェクトの募集" });
      addScheduleTo(others, "2099-03-01");
      await repository.create(newer);
      await repository.create(older);
      await repository.create(others);

      const found = await repository.findByProjectId(projectId);

      expect(found.map(toPlain)).toEqual([toPlain(older), toPlain(newer)]);
    });

    it("募集が無ければ空配列", async () => {
      const { projectId } = await seedProject();

      const found = await repository.findByProjectId(projectId);

      expect(found).toEqual([]);
    });
  });

  describe("update", () => {
    it("タイトル・説明・updatedAt を書き、日程は書かない", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      addScheduleTo(recruitment, "2099-01-10");
      await repository.create(recruitment);

      const loaded = (await repository.findById(recruitment.id))!;
      unwrap(loaded.update({ title: "新しいタイトル", description: "新しい説明" }));
      addScheduleTo(loaded, "2099-01-11"); // 日程はメモリ上で足すだけ（update では書かれない）
      await repository.update(loaded);

      const found = (await repository.findById(recruitment.id))!;
      expect(found.title).toBe("新しいタイトル");
      expect(found.description).toBe("新しい説明");
      expect(found.updatedAt).toEqual(loaded.updatedAt);
      expect(found.createdAt).toEqual(recruitment.createdAt);
      expect(found.schedules.map((s) => s.date.toString())).toEqual(["2099-01-10"]);
    });
  });

  describe("delete", () => {
    it("募集を消すと日程も消える（他の募集は残る）", async () => {
      const { projectId } = await seedProject();
      const target = newRecruitment(projectId);
      addScheduleTo(target, "2099-01-10");
      const remaining = newRecruitment(projectId);
      addScheduleTo(remaining, "2099-01-10");
      await repository.create(target);
      await repository.create(remaining);

      await repository.delete(target.id);

      expect(await repository.findById(target.id)).toBeNull();
      expect(await countSchedules(target.id)).toBe(0);
      expect(toPlain((await repository.findById(remaining.id))!)).toEqual(toPlain(remaining));
    });
  });

  describe("addSchedule", () => {
    it("日程を 1 件追加する", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      addScheduleTo(recruitment, "2099-01-10");
      await repository.create(recruitment);

      const loaded = (await repository.findById(recruitment.id))!;
      const added = addScheduleTo(loaded, "2099-01-11", {
        start: "13:00",
        end: "17:00",
        capacity: 8,
        approvalMode: ApprovalMode.MANUAL,
      });
      await repository.addSchedule(added);

      const found = (await repository.findById(recruitment.id))!;
      expect(toPlain(found)).toEqual(toPlain(loaded));
    });

    it("同じ募集に同じ日付の日程が同時に追加されたら ScheduleDateConflictError", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      await repository.create(recruitment);

      // 2 つのリクエストが同じ状態を読み、どちらもドメインの重複チェックを通る
      const first = (await repository.findById(recruitment.id))!;
      const second = (await repository.findById(recruitment.id))!;
      await repository.addSchedule(addScheduleTo(first, "2099-01-10"));
      const error = await repository
        .addSchedule(addScheduleTo(second, "2099-01-10"))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ScheduleDateConflictError);
      expect((error as ScheduleDateConflictError).date).toBe("2099-01-10");
      expect(await countSchedules(recruitment.id)).toBe(1);
    });

    it("別の募集なら同じ日付でも追加できる", async () => {
      const { projectId } = await seedProject();
      const first = newRecruitment(projectId);
      const second = newRecruitment(projectId);
      await repository.create(first);
      await repository.create(second);

      await repository.addSchedule(addScheduleTo(first, "2099-01-10"));
      await repository.addSchedule(addScheduleTo(second, "2099-01-10"));

      expect(await countSchedules(first.id)).toBe(1);
      expect(await countSchedules(second.id)).toBe(1);
    });
  });

  describe("updateSchedule", () => {
    it("日付・時間帯・定員・承認モード・updatedAt を書き換える（createdAt は変えない）", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      const original = addScheduleTo(recruitment, "2099-01-10");
      await repository.create(recruitment);

      const loaded = (await repository.findById(recruitment.id))!;
      const changed = unwrap(
        loaded.updateSchedule(original.id, {
          date: scheduleDate("2099-01-20"),
          timeRange: timeRange("08:00", "11:00"),
          capacityPerHour: capacity(20),
          approvalMode: ApprovalMode.MANUAL,
        })
      );
      await repository.updateSchedule(changed);

      const found = (await repository.findById(recruitment.id))!;
      expect(toPlain(found)).toEqual(toPlain(loaded));
      expect(found.schedules[0].createdAt).toEqual(original.createdAt);
    });

    it("変更後の日付の日程が同時に追加されていたら ScheduleDateConflictError（行は変わらない）", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      const original = addScheduleTo(recruitment, "2099-01-10");
      await repository.create(recruitment);

      const first = (await repository.findById(recruitment.id))!;
      const second = (await repository.findById(recruitment.id))!;
      await repository.addSchedule(addScheduleTo(first, "2099-01-11"));
      const changed = unwrap(
        second.updateSchedule(original.id, { date: scheduleDate("2099-01-11") })
      );
      const error = await repository.updateSchedule(changed).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ScheduleDateConflictError);
      expect((error as ScheduleDateConflictError).date).toBe("2099-01-11");
      const found = (await repository.findById(recruitment.id))!;
      expect(found.schedules.map((s) => s.date.toString())).toEqual(["2099-01-10", "2099-01-11"]);
    });

    it("別の募集の日程は書き換えない（日程 ID と募集 ID の両方で絞る）", async () => {
      const { projectId } = await seedProject();
      const target = newRecruitment(projectId);
      const targetSchedule = addScheduleTo(target, "2099-01-10");
      const another = newRecruitment(projectId);
      await repository.create(target);
      await repository.create(another);

      // 日程 ID は target のもの、募集 ID は another のもの
      await repository.updateSchedule(
        forgeSchedule(targetSchedule, { supportRecruitmentId: another.id, date: "2099-02-01" })
      );

      expect(toPlain((await repository.findById(target.id))!)).toEqual(toPlain(target));
    });
  });

  describe("removeSchedule", () => {
    it("日程を 1 件削除する（他の日程は残る）", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      const target = addScheduleTo(recruitment, "2099-01-10");
      addScheduleTo(recruitment, "2099-01-11");
      await repository.create(recruitment);

      const loaded = (await repository.findById(recruitment.id))!;
      await repository.removeSchedule(unwrap(loaded.removeSchedule(target.id)));

      const found = (await repository.findById(recruitment.id))!;
      expect(found.schedules.map((s) => s.date.toString())).toEqual(["2099-01-11"]);
    });

    it("別の募集の日程は削除しない（日程 ID と募集 ID の両方で絞る）", async () => {
      const { projectId } = await seedProject();
      const target = newRecruitment(projectId);
      const targetSchedule = addScheduleTo(target, "2099-01-10");
      const another = newRecruitment(projectId);
      await repository.create(target);
      await repository.create(another);

      await repository.removeSchedule(
        forgeSchedule(targetSchedule, { supportRecruitmentId: another.id })
      );

      expect(await countSchedules(target.id)).toBe(1);
    });
  });

  describe("同時に削除されたとき（例外にせず、何もしない）", () => {
    it("消えた募集の update / delete は何もしない", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      await repository.create(recruitment);
      const loaded = (await repository.findById(recruitment.id))!;
      await repository.delete(recruitment.id);

      unwrap(loaded.update({ title: "消えた後の更新" }));
      await expect(repository.update(loaded)).resolves.toBeUndefined();
      await expect(repository.delete(recruitment.id)).resolves.toBeUndefined();

      expect(await repository.findById(recruitment.id)).toBeNull();
    });

    it("消えた募集への addSchedule は、外部キー違反を例外にせず何もしない", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      await repository.create(recruitment);
      const loaded = (await repository.findById(recruitment.id))!;
      await repository.delete(recruitment.id);

      await expect(
        repository.addSchedule(addScheduleTo(loaded, "2099-01-10"))
      ).resolves.toBeUndefined();

      expect(await countSchedules(recruitment.id)).toBe(0);
    });

    it("消えた日程の updateSchedule / removeSchedule は何もしない", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      const schedule = addScheduleTo(recruitment, "2099-01-10");
      await repository.create(recruitment);
      const loaded = (await repository.findById(recruitment.id))!;
      await repository.removeSchedule(schedule);

      const changed = unwrap(loaded.updateSchedule(schedule.id, { capacityPerHour: capacity(9) }));
      await expect(repository.updateSchedule(changed)).resolves.toBeUndefined();
      await expect(repository.removeSchedule(schedule)).resolves.toBeUndefined();

      expect(await countSchedules(recruitment.id)).toBe(0);
    });

    it("消えたプロジェクトへの create は、外部キー違反を例外にせず何もしない", async () => {
      const { projectId } = await seedProject();
      const recruitment = newRecruitment(projectId);
      addScheduleTo(recruitment, "2099-01-10");
      await db.deleteFrom("projects").where("id", "=", projectId.toString()).execute();

      await expect(repository.create(recruitment)).resolves.toBeUndefined();

      expect(await repository.findById(recruitment.id)).toBeNull();
      expect(await countSchedules(recruitment.id)).toBe(0);
    });
  });

  describe("JST の開催日の往復（Node のタイムゾーンに左右されない）", () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    // UTC+14 / UTC-11 / JST。Date を経由すると、どれかで日付が前後にずれる
    it.each(["Pacific/Kiritimati", "Pacific/Pago_Pago", "Asia/Tokyo"])(
      "TZ=%s でも、書いた日付がそのまま DB に入り、そのまま読み戻せる",
      async (tz) => {
        process.env.TZ = tz;
        const { projectId } = await seedProject();
        const recruitment = newRecruitment(projectId);
        addScheduleTo(recruitment, "2026-01-01");
        addScheduleTo(recruitment, "2026-12-31");
        await repository.create(recruitment);

        const loaded = (await repository.findById(recruitment.id))!;
        expect(loaded.schedules.map((s) => s.date.toString())).toEqual([
          "2026-01-01",
          "2026-12-31",
        ]);
        expect(await storedDates(recruitment.id)).toEqual(["2026-01-01", "2026-12-31"]);

        // updateSchedule / addSchedule でも同じ
        const changed = unwrap(
          loaded.updateSchedule(loaded.schedules[0].id, { date: scheduleDate("2026-03-01") })
        );
        await repository.updateSchedule(changed);
        await repository.addSchedule(addScheduleTo(loaded, "2026-06-30"));

        const reloaded = (await repository.findById(recruitment.id))!;
        expect(reloaded.schedules.map((s) => s.date.toString())).toEqual([
          "2026-03-01",
          "2026-06-30",
          "2026-12-31",
        ]);
        expect(await storedDates(recruitment.id)).toEqual([
          "2026-03-01",
          "2026-06-30",
          "2026-12-31",
        ]);
      }
    );
  });

  describe("ユースケースとつなぐ（A-2 の port をすべて満たす）", () => {
    it("募集の作成から削除まで、6 本のユースケースが通る", async () => {
      const { leaderId, projectId } = await seedProject();
      const accountId = leaderId;

      const created = unwrap(
        await new CreateRecruitmentUseCase(repository).execute({
          accountId,
          projectId: projectId.toString(),
          title: "畑の草刈り",
          description: "一緒に草刈りをしてくれる人を募集します",
        })
      );
      const recruitmentId = created.recruitmentId;

      unwrap(
        await new UpdateRecruitmentUseCase(repository).execute({
          accountId,
          recruitmentId,
          title: "畑の草刈りと収穫",
        })
      );

      const addSchedule = new AddScheduleUseCase(repository);
      const scheduleInput = {
        accountId,
        recruitmentId,
        startTime: "10:00",
        endTime: "15:00",
        capacityPerHour: 5,
        approvalMode: "AUTO",
      };
      const { scheduleId } = unwrap(
        await addSchedule.execute({ ...scheduleInput, date: "2099-01-10" })
      );
      expect(await addSchedule.execute({ ...scheduleInput, date: "2099-01-10" })).toEqual({
        ok: false,
        error: { type: "DUPLICATE_SCHEDULE_DATE", date: "2099-01-10" },
      });

      unwrap(
        await new UpdateScheduleUseCase(repository).execute({
          accountId,
          recruitmentId,
          scheduleId,
          date: "2099-01-11",
          approvalMode: "MANUAL",
        })
      );

      const id = unwrap(SupportRecruitmentId.from(recruitmentId));
      const afterUpdate = (await repository.findById(id))!;
      expect(afterUpdate.title).toBe("畑の草刈りと収穫");
      expect(afterUpdate.schedules.map((s) => [s.date.toString(), s.approvalMode])).toEqual([
        ["2099-01-11", "MANUAL"],
      ]);

      unwrap(
        await new RemoveScheduleUseCase(repository).execute({
          accountId,
          recruitmentId,
          scheduleId,
        })
      );
      expect((await repository.findById(id))!.schedules).toEqual([]);

      unwrap(await new DeleteRecruitmentUseCase(repository).execute({ accountId, recruitmentId }));
      expect(await repository.findById(id)).toBeNull();
    });
  });
});

// ==================== ヘルパー ====================

/** 形式は正しいが、どこにも無い ID */
const MISSING_PROJECT_ID = unwrap(ProjectId.from("00000000-0000-4000-b000-0000000000ff"));
const MISSING_RECRUITMENT_ID = unwrap(
  SupportRecruitmentId.from("00000000-0000-4000-8000-0000000000ff")
);

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
  return result.value;
}

const scheduleDate = (value: string) => unwrap(ScheduleDate.from(value));
const timeRange = (start: string, end: string) => unwrap(TimeRange.create({ start, end }));
const capacity = (value: number) => unwrap(CapacityPerHour.from(value));

/** リーダーとプロジェクトを DB に入れる */
async function seedProject(
  email = "leader@example.com"
): Promise<{ leaderId: string; projectId: ProjectId }> {
  const leader = await insertRow("accounts", {
    email,
    displayName: "リーダー",
    status: "ACTIVE",
    roles: ["LEADER"],
    passwordHash: "dummy",
  });
  const project = await insertRow("projects", {
    ownerAccountId: leader.id,
    title: "畑のプロジェクト",
    status: "DRAFT",
    phase: "VISION",
  });
  return { leaderId: leader.id, projectId: unwrap(ProjectId.from(project.id)) };
}

/** 新しい募集（まだ保存しない） */
function newRecruitment(
  projectId: ProjectId,
  overrides?: { title?: string; createdAt?: Date }
): SupportRecruitment {
  return unwrap(
    SupportRecruitment.create({
      projectId,
      type: RecruitmentType.ACTIVITY,
      title: overrides?.title ?? "畑の草刈り",
      description: "一緒に草刈りをしてくれる人を募集します",
      createdAt: overrides?.createdAt,
    })
  );
}

/** ルートのメソッドで日程を足し、足した日程を返す（既定は 10:00〜15:00・定員 5・AUTO） */
function addScheduleTo(
  recruitment: SupportRecruitment,
  date: string,
  options?: { start?: string; end?: string; capacity?: number; approvalMode?: ApprovalMode }
): RecruitmentSchedule {
  return unwrap(
    recruitment.addSchedule({
      date: scheduleDate(date),
      timeRange: timeRange(options?.start ?? "10:00", options?.end ?? "15:00"),
      capacityPerHour: capacity(options?.capacity ?? 5),
      approvalMode: options?.approvalMode ?? ApprovalMode.AUTO,
    })
  );
}

/** ルートを通さずに、募集 ID や日付を差し替えた日程を作る（別の募集の日程に触らないことの確認用） */
function forgeSchedule(
  schedule: RecruitmentSchedule,
  overrides: { supportRecruitmentId: SupportRecruitmentId; date?: string }
): RecruitmentSchedule {
  return RecruitmentSchedule.reconstruct({
    id: schedule.id,
    supportRecruitmentId: overrides.supportRecruitmentId,
    date: overrides.date ? scheduleDate(overrides.date) : schedule.date,
    timeRange: schedule.timeRange,
    capacityPerHour: schedule.capacityPerHour,
    approvalMode: schedule.approvalMode,
    createdAt: schedule.createdAt,
    updatedAt: new Date(),
  });
}

/** 比較用に、募集と日程をプレーンなオブジェクトにする */
function toPlain(recruitment: SupportRecruitment) {
  return {
    id: recruitment.id.toString(),
    projectId: recruitment.projectId.toString(),
    type: recruitment.type,
    title: recruitment.title,
    description: recruitment.description,
    createdAt: recruitment.createdAt,
    updatedAt: recruitment.updatedAt,
    schedules: recruitment.schedules.map((s) => ({
      id: s.id.toString(),
      supportRecruitmentId: s.supportRecruitmentId.toString(),
      date: s.date.toString(),
      startTime: s.timeRange.start,
      endTime: s.timeRange.end,
      capacityPerHour: s.capacityPerHour.value,
      approvalMode: s.approvalMode,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  };
}

async function countSchedules(recruitmentId: SupportRecruitmentId): Promise<number> {
  const row = await db
    .selectFrom("recruitment_schedules")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("supportRecruitmentId", "=", recruitmentId.toString())
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

/** DB に入っている開催日（DB 側で文字列にして、日付の古い順） */
async function storedDates(recruitmentId: SupportRecruitmentId): Promise<string[]> {
  const rows = await db
    .selectFrom("recruitment_schedules")
    .select((eb) => eb.fn<string>("to_char", [eb.ref("date"), eb.val("YYYY-MM-DD")]).as("date"))
    .where("supportRecruitmentId", "=", recruitmentId.toString())
    .orderBy("date", "asc")
    .execute();
  return rows.map((row) => row.date);
}
