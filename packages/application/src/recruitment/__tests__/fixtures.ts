import {
  AccountId,
  ApprovalMode,
  CapacityPerHour,
  ProjectId,
  RecruitmentSchedule,
  RecruitmentScheduleId,
  RecruitmentType,
  type Result,
  ScheduleDate,
  SupportRecruitment,
  SupportRecruitmentId,
  TimeRange,
} from "@physifun/domain";
import type { AddSchedulePort } from "../ports/AddSchedulePort";
import type { CreateRecruitmentPort } from "../ports/CreateRecruitmentPort";
import type { DeleteRecruitmentPort } from "../ports/DeleteRecruitmentPort";
import type { ListRecruitmentsPort } from "../ports/ListRecruitmentsPort";
import type { RemoveSchedulePort } from "../ports/RemoveSchedulePort";
import type { UpdateRecruitmentPort } from "../ports/UpdateRecruitmentPort";
import type { UpdateSchedulePort } from "../ports/UpdateSchedulePort";

// ==================== ID ====================

export const OWNER_ACCOUNT_ID = "00000000-0000-4000-a000-000000000001";
export const OTHER_ACCOUNT_ID = "00000000-0000-4000-a000-000000000002";
export const PROJECT_ID = "00000000-0000-4000-b000-000000000001";
export const OTHER_PROJECT_ID = "00000000-0000-4000-b000-000000000002";
export const RECRUITMENT_ID = "00000000-0000-4000-8000-000000000001";
export const OTHER_RECRUITMENT_ID = "00000000-0000-4000-8000-000000000002";
export const SCHEDULE_ID = "00000000-0000-4000-9000-000000000001";
export const OTHER_SCHEDULE_ID = "00000000-0000-4000-9000-000000000002";
/** 他人の募集（OTHER_RECRUITMENT_ID）にある日程の ID */
export const FOREIGN_SCHEDULE_ID = "00000000-0000-4000-9000-000000000003";
/** 形式は正しいが、どこにも無い ID */
export const MISSING_ID = "00000000-0000-4000-8000-0000000000ff";

// ==================== 値オブジェクト ====================

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`fixture broken: ${JSON.stringify(result.error)}`);
  return result.value;
}

export const accountId = (value: string) => unwrap(AccountId.from(value));
export const projectId = (value: string) => unwrap(ProjectId.from(value));
export const recruitmentId = (value: string) => unwrap(SupportRecruitmentId.from(value));
export const scheduleId = (value: string) => unwrap(RecruitmentScheduleId.from(value));

// ==================== エンティティ ====================

/** テスト用の日程（既定は RECRUITMENT_ID の募集の、2099-01-10 の 10:00〜15:00・定員 5・AUTO） */
export function createSchedule(overrides?: {
  id?: string;
  date?: string;
  recruitmentId?: string;
}): RecruitmentSchedule {
  return RecruitmentSchedule.reconstruct({
    id: scheduleId(overrides?.id ?? SCHEDULE_ID),
    supportRecruitmentId: recruitmentId(overrides?.recruitmentId ?? RECRUITMENT_ID),
    date: unwrap(ScheduleDate.from(overrides?.date ?? "2099-01-10")),
    timeRange: unwrap(TimeRange.create({ start: "10:00", end: "15:00" })),
    capacityPerHour: unwrap(CapacityPerHour.from(5)),
    approvalMode: ApprovalMode.AUTO,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  });
}

/** テスト用の募集（既定は RECRUITMENT_ID。PROJECT_ID のプロジェクトに属する） */
export function createRecruitment(
  schedules: RecruitmentSchedule[] = [],
  overrides?: { id?: string; projectId?: string }
): SupportRecruitment {
  return SupportRecruitment.reconstruct({
    id: recruitmentId(overrides?.id ?? RECRUITMENT_ID),
    projectId: projectId(overrides?.projectId ?? PROJECT_ID),
    type: RecruitmentType.ACTIVITY,
    title: "畑の草刈り",
    description: "一緒に草刈りをしてくれる人を募集します",
    schedules,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  });
}

// ==================== インメモリ実装 ====================

/**
 * 募集のユースケースの port をまとめて満たすインメモリ実装。書き込みは呼び出しを記録するだけ。
 */
export class InMemoryRecruitmentPort
  implements
    ListRecruitmentsPort,
    CreateRecruitmentPort,
    UpdateRecruitmentPort,
    DeleteRecruitmentPort,
    AddSchedulePort,
    UpdateSchedulePort,
    RemoveSchedulePort
{
  /** プロジェクト ID → 所有者のアカウント ID */
  owners = new Map<string, string>([[PROJECT_ID, OWNER_ACCOUNT_ID]]);
  recruitments: SupportRecruitment[] = [];

  created: SupportRecruitment[] = [];
  updated: SupportRecruitment[] = [];
  deleted: SupportRecruitmentId[] = [];
  addedSchedules: RecruitmentSchedule[] = [];
  updatedSchedules: RecruitmentSchedule[] = [];
  removedSchedules: RecruitmentSchedule[] = [];

  /** addSchedule / updateSchedule で投げる例外（同時実行での unique 違反などの再現用） */
  scheduleWriteError: Error | null = null;

  async findProjectOwner(id: ProjectId): Promise<AccountId | null> {
    const owner = this.owners.get(id.toString());
    return owner ? accountId(owner) : null;
  }

  async findById(id: SupportRecruitmentId): Promise<SupportRecruitment | null> {
    return this.recruitments.find((r) => r.id.equals(id)) ?? null;
  }

  async findByProjectId(id: ProjectId): Promise<SupportRecruitment[]> {
    return this.recruitments.filter((r) => r.projectId.equals(id));
  }

  async create(recruitment: SupportRecruitment): Promise<void> {
    this.created.push(recruitment);
  }

  async update(recruitment: SupportRecruitment): Promise<void> {
    this.updated.push(recruitment);
  }

  async delete(id: SupportRecruitmentId): Promise<void> {
    this.deleted.push(id);
  }

  async addSchedule(schedule: RecruitmentSchedule): Promise<void> {
    if (this.scheduleWriteError) throw this.scheduleWriteError;
    this.addedSchedules.push(schedule);
  }

  async updateSchedule(schedule: RecruitmentSchedule): Promise<void> {
    if (this.scheduleWriteError) throw this.scheduleWriteError;
    this.updatedSchedules.push(schedule);
  }

  async removeSchedule(schedule: RecruitmentSchedule): Promise<void> {
    this.removedSchedules.push(schedule);
  }

  /** 何かが書き込まれたか（早期 return のエラーで副作用が無いことの確認用） */
  get hasWrites(): boolean {
    return (
      this.created.length +
        this.updated.length +
        this.deleted.length +
        this.addedSchedules.length +
        this.updatedSchedules.length +
        this.removedSchedules.length >
      0
    );
  }
}

/**
 * 他人（OTHER_ACCOUNT_ID）のプロジェクトの募集 OTHER_RECRUITMENT_ID を足す。日程 FOREIGN_SCHEDULE_ID を持つ。
 */
export function addOthersRecruitment(port: InMemoryRecruitmentPort): void {
  port.owners.set(OTHER_PROJECT_ID, OTHER_ACCOUNT_ID);
  port.recruitments.push(
    createRecruitment(
      [createSchedule({ id: FOREIGN_SCHEDULE_ID, recruitmentId: OTHER_RECRUITMENT_ID })],
      { id: OTHER_RECRUITMENT_ID, projectId: OTHER_PROJECT_ID }
    )
  );
}
