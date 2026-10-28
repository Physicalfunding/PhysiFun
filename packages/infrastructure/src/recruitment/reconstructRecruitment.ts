import {
  CapacityPerHour,
  ProjectId,
  RecruitmentSchedule,
  RecruitmentScheduleId,
  ScheduleDate,
  SupportRecruitment,
  SupportRecruitmentId,
  TimeRange,
  isApprovalMode,
  isRecruitmentType,
} from "@physifun/domain";

/**
 * support_recruitments の行（と、その募集の日程）からドメインエンティティを復元する共通ヘルパー
 *
 * 日程の並べ替えは `SupportRecruitment.reconstruct()` が行う（日付の古い順）。
 */
export function reconstructRecruitment(
  row: {
    id: string;
    projectId: string;
    type: string;
    title: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
  },
  schedules: readonly RecruitmentSchedule[]
): SupportRecruitment {
  const idResult = SupportRecruitmentId.from(row.id);
  if (!idResult.ok) throw new Error(`Invalid SupportRecruitmentId: ${row.id}`);

  const projectIdResult = ProjectId.from(row.projectId);
  if (!projectIdResult.ok) throw new Error(`Invalid ProjectId: ${row.projectId}`);

  if (!isRecruitmentType(row.type)) throw new Error(`Invalid RecruitmentType: ${row.type}`);

  return SupportRecruitment.reconstruct({
    id: idResult.value,
    projectId: projectIdResult.value,
    type: row.type,
    title: row.title,
    description: row.description,
    schedules,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * recruitment_schedules の行からドメインエンティティを復元する共通ヘルパー
 *
 * `date` は `"YYYY-MM-DD"` の文字列で受け取る（pg の既定の変換で `Date` にすると、
 * Node のタイムゾーンで日付がずれるため。`KyselyRecruitmentRepository` 参照）。
 */
export function reconstructRecruitmentSchedule(row: {
  id: string;
  supportRecruitmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacityPerHour: number;
  approvalMode: string;
  createdAt: Date;
  updatedAt: Date;
}): RecruitmentSchedule {
  const idResult = RecruitmentScheduleId.from(row.id);
  if (!idResult.ok) throw new Error(`Invalid RecruitmentScheduleId: ${row.id}`);

  const recruitmentIdResult = SupportRecruitmentId.from(row.supportRecruitmentId);
  if (!recruitmentIdResult.ok) {
    throw new Error(`Invalid SupportRecruitmentId: ${row.supportRecruitmentId}`);
  }

  const dateResult = ScheduleDate.from(row.date);
  if (!dateResult.ok) throw new Error(`Invalid ScheduleDate: ${row.date}`);

  const timeRangeResult = TimeRange.create({ start: row.startTime, end: row.endTime });
  if (!timeRangeResult.ok) {
    throw new Error(`Invalid TimeRange: ${JSON.stringify(timeRangeResult.error)}`);
  }

  const capacityResult = CapacityPerHour.from(row.capacityPerHour);
  if (!capacityResult.ok) throw new Error(`Invalid CapacityPerHour: ${row.capacityPerHour}`);

  if (!isApprovalMode(row.approvalMode)) {
    throw new Error(`Invalid ApprovalMode: ${row.approvalMode}`);
  }

  return RecruitmentSchedule.reconstruct({
    id: idResult.value,
    supportRecruitmentId: recruitmentIdResult.value,
    date: dateResult.value,
    timeRange: timeRangeResult.value,
    capacityPerHour: capacityResult.value,
    approvalMode: row.approvalMode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
