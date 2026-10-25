import { describe, expect, it } from "vitest";
import { ProjectId } from "../../project/value-objects/ProjectId";
import { RecruitmentSchedule } from "../entities/RecruitmentSchedule";
import { SUPPORT_RECRUITMENT_LIMITS, SupportRecruitment } from "../entities/SupportRecruitment";
import { ApprovalMode } from "../value-objects/ApprovalMode";
import { RecruitmentScheduleId } from "../value-objects/RecruitmentScheduleId";
import { RecruitmentType } from "../value-objects/RecruitmentType";
import { SupportRecruitmentId } from "../value-objects/SupportRecruitmentId";
import { capacity, date, timeRange } from "./fixtures";

const PAST = new Date("2026-10-01T00:00:00Z");

function createRecruitment(): SupportRecruitment {
  const result = SupportRecruitment.create({
    projectId: ProjectId.generate(),
    type: RecruitmentType.ACTIVITY,
    title: "畑の草取り",
    description: "午前中に畑の草取りを手伝ってください",
    createdAt: PAST,
  });
  if (!result.ok) throw new Error("fixture broken");
  return result.value;
}

function scheduleInput(day: string) {
  return {
    date: date(day),
    timeRange: timeRange("10:00", "12:00"),
    capacityPerHour: capacity(5),
    approvalMode: ApprovalMode.AUTO,
  };
}

function addSchedule(recruitment: SupportRecruitment, day: string): RecruitmentSchedule {
  const result = recruitment.addSchedule(scheduleInput(day));
  if (!result.ok) throw new Error("fixture broken");
  return result.value;
}

function scheduleDates(recruitment: SupportRecruitment): string[] {
  return recruitment.schedules.map((s) => s.date.toString());
}

describe("SupportRecruitment", () => {
  describe("create", () => {
    it("タイトル・説明の前後の空白を除いて作成し、日程は空", () => {
      const result = SupportRecruitment.create({
        projectId: ProjectId.generate(),
        type: RecruitmentType.ACTIVITY,
        title: "  畑の草取り  ",
        description: "\n午前中の作業です\n",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const recruitment = result.value;
      expect(recruitment.id).toBeInstanceOf(SupportRecruitmentId);
      expect(recruitment.type).toBe(RecruitmentType.ACTIVITY);
      expect(recruitment.title).toBe("畑の草取り");
      expect(recruitment.description).toBe("午前中の作業です");
      expect(recruitment.schedules).toEqual([]);
      expect(recruitment.updatedAt).toEqual(recruitment.createdAt);
    });

    it.each([
      ["title", "   ", "TITLE_REQUIRED"],
      ["description", "", "DESCRIPTION_REQUIRED"],
    ] as const)("%s が空ならエラー", (field, value, type) => {
      const result = SupportRecruitment.create({
        projectId: ProjectId.generate(),
        type: RecruitmentType.ACTIVITY,
        title: "タイトル",
        description: "説明",
        [field]: value,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({ type });
      }
    });

    it.each([
      ["title", SUPPORT_RECRUITMENT_LIMITS.title, "TITLE_TOO_LONG"],
      ["description", SUPPORT_RECRUITMENT_LIMITS.description, "DESCRIPTION_TOO_LONG"],
    ] as const)("%s は上限 %d 文字までで、超えるとエラー", (field, maxLength, type) => {
      const input = {
        projectId: ProjectId.generate(),
        type: RecruitmentType.ACTIVITY,
        title: "タイトル",
        description: "説明",
      };
      expect(SupportRecruitment.create({ ...input, [field]: "あ".repeat(maxLength) }).ok).toBe(
        true
      );

      const result = SupportRecruitment.create({ ...input, [field]: "あ".repeat(maxLength + 1) });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({ type, maxLength, actualLength: maxLength + 1 });
      }
    });
  });

  describe("update", () => {
    it("指定した項目だけ変え、updatedAt を新しくする", () => {
      const recruitment = createRecruitment();
      const result = recruitment.update({ title: " 畑の収穫 " });

      expect(result.ok).toBe(true);
      expect(recruitment.title).toBe("畑の収穫");
      expect(recruitment.description).toBe("午前中に畑の草取りを手伝ってください");
      expect(recruitment.updatedAt.getTime()).toBeGreaterThan(PAST.getTime());
    });

    it("1 つでも検証に失敗したら、何も変えない（guard-first）", () => {
      const recruitment = createRecruitment();
      const result = recruitment.update({ title: "新しいタイトル", description: "  " });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({ type: "DESCRIPTION_REQUIRED" });
      }
      expect(recruitment.title).toBe("畑の草取り");
      expect(recruitment.updatedAt).toEqual(PAST);
    });
  });

  describe("addSchedule", () => {
    it("日程を追加して返す。日程は募集の ID を持ち、日付の古い順に並ぶ", () => {
      const recruitment = createRecruitment();
      addSchedule(recruitment, "2026-11-10");
      const added = addSchedule(recruitment, "2026-11-03");

      expect(added.supportRecruitmentId.equals(recruitment.id)).toBe(true);
      expect(scheduleDates(recruitment)).toEqual(["2026-11-03", "2026-11-10"]);
    });

    it("同じ日付の日程はエラーになり、日程は増えない", () => {
      const recruitment = createRecruitment();
      addSchedule(recruitment, "2026-11-03");

      const result = recruitment.addSchedule(scheduleInput("2026-11-03"));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({ type: "DUPLICATE_SCHEDULE_DATE", date: "2026-11-03" });
      }
      expect(recruitment.schedules).toHaveLength(1);
    });
  });

  it("日程を追加・変更・削除しても、募集の updatedAt は変わらない", () => {
    const recruitment = createRecruitment();
    const schedule = addSchedule(recruitment, "2026-11-03");
    expect(recruitment.updatedAt).toEqual(PAST);

    recruitment.updateSchedule(schedule.id, { capacityPerHour: capacity(20) });
    expect(recruitment.updatedAt).toEqual(PAST);

    recruitment.removeSchedule(schedule.id);
    expect(recruitment.updatedAt).toEqual(PAST);
  });

  describe("updateSchedule", () => {
    it("日程を差し替え、変更後の日程を返す。元の日程のインスタンスは変わらない", () => {
      const recruitment = createRecruitment();
      const original = addSchedule(recruitment, "2026-11-03");

      const result = recruitment.updateSchedule(original.id, { capacityPerHour: capacity(20) });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.id.equals(original.id)).toBe(true);
      expect(result.value.capacityPerHour.value).toBe(20);
      expect(recruitment.schedules).toEqual([result.value]);
      expect(original.capacityPerHour.value).toBe(5);
    });

    it("日付を変えたら並び直す。自分自身と同じ日付への変更はできる", () => {
      const recruitment = createRecruitment();
      const first = addSchedule(recruitment, "2026-11-03");
      addSchedule(recruitment, "2026-11-10");

      expect(recruitment.updateSchedule(first.id, { date: date("2026-11-03") }).ok).toBe(true);
      expect(recruitment.updateSchedule(first.id, { date: date("2026-11-20") }).ok).toBe(true);
      expect(scheduleDates(recruitment)).toEqual(["2026-11-10", "2026-11-20"]);
    });

    it("他の日程と同じ日付にはできない", () => {
      const recruitment = createRecruitment();
      const first = addSchedule(recruitment, "2026-11-03");
      addSchedule(recruitment, "2026-11-10");

      const result = recruitment.updateSchedule(first.id, { date: date("2026-11-10") });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({ type: "DUPLICATE_SCHEDULE_DATE", date: "2026-11-10" });
      }
      expect(scheduleDates(recruitment)).toEqual(["2026-11-03", "2026-11-10"]);
    });

    it("無い日程はエラー", () => {
      const recruitment = createRecruitment();
      const unknownId = RecruitmentScheduleId.generate();

      const result = recruitment.updateSchedule(unknownId, { approvalMode: ApprovalMode.MANUAL });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "SCHEDULE_NOT_FOUND",
          scheduleId: unknownId.toString(),
        });
      }
    });
  });

  describe("removeSchedule", () => {
    it("日程を削除し、削除した日程を返す", () => {
      const recruitment = createRecruitment();
      const first = addSchedule(recruitment, "2026-11-03");
      addSchedule(recruitment, "2026-11-10");

      const result = recruitment.removeSchedule(first.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(first);
      }
      expect(scheduleDates(recruitment)).toEqual(["2026-11-10"]);
    });

    it("無い日程はエラー", () => {
      const recruitment = createRecruitment();
      const result = recruitment.removeSchedule(RecruitmentScheduleId.generate());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("SCHEDULE_NOT_FOUND");
      }
    });
  });

  it("reconstruct() は日程を日付の古い順に並べ直す", () => {
    const id = SupportRecruitmentId.generate();
    const schedule = (day: string) =>
      RecruitmentSchedule.create({ supportRecruitmentId: id, ...scheduleInput(day) });

    const recruitment = SupportRecruitment.reconstruct({
      id,
      projectId: ProjectId.generate(),
      type: RecruitmentType.ACTIVITY,
      title: "畑の草取り",
      description: "説明",
      schedules: [schedule("2026-12-01"), schedule("2026-11-03"), schedule("2026-11-15")],
      createdAt: PAST,
      updatedAt: PAST,
    });

    expect(scheduleDates(recruitment)).toEqual(["2026-11-03", "2026-11-15", "2026-12-01"]);
  });
});
