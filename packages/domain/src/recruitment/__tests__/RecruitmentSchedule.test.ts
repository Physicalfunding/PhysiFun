import { describe, expect, it } from "vitest";
import { RecruitmentSchedule } from "../entities/RecruitmentSchedule";
import { ApprovalMode } from "../value-objects/ApprovalMode";
import { RecruitmentScheduleId } from "../value-objects/RecruitmentScheduleId";
import { SupportRecruitmentId } from "../value-objects/SupportRecruitmentId";
import { capacity, date, timeRange } from "./fixtures";

function createSchedule(): RecruitmentSchedule {
  return RecruitmentSchedule.create({
    supportRecruitmentId: SupportRecruitmentId.generate(),
    date: date("2026-11-03"),
    timeRange: timeRange("10:00", "15:00"),
    capacityPerHour: capacity(5),
    approvalMode: ApprovalMode.AUTO,
    createdAt: new Date("2026-10-01T00:00:00Z"),
  });
}

describe("RecruitmentSchedule", () => {
  it("create() で ID が発行され、createdAt と updatedAt が同じになる", () => {
    const schedule = createSchedule();
    expect(schedule.id).toBeInstanceOf(RecruitmentScheduleId);
    expect(schedule.date.toString()).toBe("2026-11-03");
    expect(schedule.timeRange.start).toBe("10:00");
    expect(schedule.timeRange.end).toBe("15:00");
    expect(schedule.capacityPerHour.value).toBe(5);
    expect(schedule.approvalMode).toBe(ApprovalMode.AUTO);
    expect(schedule.updatedAt).toEqual(schedule.createdAt);
  });

  describe("withChanges", () => {
    it("指定した項目だけ変えた新しい日程を返し、元の日程は変わらない", () => {
      const original = createSchedule();
      const changed = original.withChanges({
        capacityPerHour: capacity(8),
        approvalMode: ApprovalMode.MANUAL,
      });

      expect(changed).not.toBe(original);
      expect(changed.capacityPerHour.value).toBe(8);
      expect(changed.approvalMode).toBe(ApprovalMode.MANUAL);
      expect(changed.date.equals(original.date)).toBe(true);
      expect(changed.timeRange.equals(original.timeRange)).toBe(true);

      expect(original.capacityPerHour.value).toBe(5);
      expect(original.approvalMode).toBe(ApprovalMode.AUTO);
    });

    it("id / supportRecruitmentId / createdAt は引き継ぎ、updatedAt は新しくなる", () => {
      const original = createSchedule();
      const changed = original.withChanges({ date: date("2026-11-04") });

      expect(changed.id.equals(original.id)).toBe(true);
      expect(changed.supportRecruitmentId.equals(original.supportRecruitmentId)).toBe(true);
      expect(changed.createdAt).toEqual(original.createdAt);
      expect(changed.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime());
    });
  });

  it("reconstruct() で永続化層の値をそのまま復元できる", () => {
    const id = RecruitmentScheduleId.generate();
    const supportRecruitmentId = SupportRecruitmentId.generate();
    const createdAt = new Date("2026-10-01T00:00:00Z");
    const updatedAt = new Date("2026-10-02T00:00:00Z");

    const schedule = RecruitmentSchedule.reconstruct({
      id,
      supportRecruitmentId,
      date: date("2026-12-24"),
      timeRange: timeRange("18:00", "21:00"),
      capacityPerHour: capacity(100),
      approvalMode: ApprovalMode.MANUAL,
      createdAt,
      updatedAt,
    });

    expect(schedule.id).toBe(id);
    expect(schedule.supportRecruitmentId).toBe(supportRecruitmentId);
    expect(schedule.date.toString()).toBe("2026-12-24");
    expect(schedule.createdAt).toBe(createdAt);
    expect(schedule.updatedAt).toBe(updatedAt);
  });
});
