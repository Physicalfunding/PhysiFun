import type { ProjectId } from "../../project/value-objects/ProjectId";
import { type Result, err, ok } from "../../shared/result";
import type {
  RecruitmentScheduleError,
  SupportRecruitmentUpdateError,
} from "../errors/RecruitmentError";
import type { ApprovalMode } from "../value-objects/ApprovalMode";
import type { CapacityPerHour } from "../value-objects/CapacityPerHour";
import type { RecruitmentScheduleId } from "../value-objects/RecruitmentScheduleId";
import type { RecruitmentType } from "../value-objects/RecruitmentType";
import type { ScheduleDate } from "../value-objects/ScheduleDate";
import { SupportRecruitmentId } from "../value-objects/SupportRecruitmentId";
import type { TimeRange } from "../value-objects/TimeRange";
import { RecruitmentSchedule, type RecruitmentScheduleChanges } from "./RecruitmentSchedule";

/**
 * フィールド文字数上限（仮値）
 */
const LIMITS = {
  title: 100,
  description: 2000,
} as const;

/**
 * SupportRecruitment 集約ルート
 *
 * プロジェクトに紐づくサポート募集。日程（`RecruitmentSchedule`）を子に持つ。
 *
 * - `type` は作成時に決まり、変わらない（初回リリースは ACTIVITY のみ）
 * - title / description は前後の空白を除いて 1 文字以上（どちらも必須）。上限は `SUPPORT_RECRUITMENT_LIMITS`
 * - 1 募集につき 1 日 1 日程（同じ日付の日程は持てない）
 * - `schedules` は常に日付の古い順
 * - `updatedAt` は募集自身の項目（タイトル・説明）を変えたときに更新する。日程を変えたときは、
 *   その日程の `updatedAt` が変わる（日程は 1 件ずつ保存するため。`RecruitmentRepository` 参照）
 * - 所有者のチェックと、プロジェクトの公開状態による制限は UseCase 側で行う
 */
export class SupportRecruitment {
  private constructor(
    private readonly _id: SupportRecruitmentId,
    private readonly _projectId: ProjectId,
    private readonly _type: RecruitmentType,
    private _title: string,
    private _description: string,
    private _schedules: readonly RecruitmentSchedule[],
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新しい募集を作る（日程はまだ無い）。
   */
  static create(input: {
    projectId: ProjectId;
    type: RecruitmentType;
    title: string;
    description: string;
    id?: SupportRecruitmentId;
    createdAt?: Date;
  }): Result<SupportRecruitment, SupportRecruitmentUpdateError> {
    const title = normalizeTitle(input.title);
    if (!title.ok) return title;

    const description = normalizeDescription(input.description);
    if (!description.ok) return description;

    const now = input.createdAt ?? new Date();
    return ok(
      new SupportRecruitment(
        input.id ?? SupportRecruitmentId.generate(),
        input.projectId,
        input.type,
        title.value,
        description.value,
        [],
        now,
        now
      )
    );
  }

  /**
   * 永続化層からの復元。日程は日付の古い順に並べ直す。
   */
  static reconstruct(input: {
    id: SupportRecruitmentId;
    projectId: ProjectId;
    type: RecruitmentType;
    title: string;
    description: string;
    schedules: readonly RecruitmentSchedule[];
    createdAt: Date;
    updatedAt: Date;
  }): SupportRecruitment {
    return new SupportRecruitment(
      input.id,
      input.projectId,
      input.type,
      input.title,
      input.description,
      sortByDate(input.schedules),
      input.createdAt,
      input.updatedAt
    );
  }

  // ---- Getters ----

  get id(): SupportRecruitmentId {
    return this._id;
  }
  get projectId(): ProjectId {
    return this._projectId;
  }
  get type(): RecruitmentType {
    return this._type;
  }
  get title(): string {
    return this._title;
  }
  get description(): string {
    return this._description;
  }
  /** 日程（日付の古い順） */
  get schedules(): readonly RecruitmentSchedule[] {
    return this._schedules;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ---- Update ----

  /**
   * タイトル・説明を更新する（guard-first, write-last）。
   *
   * 全バリデーションを先に通し、失敗時はエンティティを一切変更しない。
   */
  update(input: {
    title?: string;
    description?: string;
  }): Result<void, SupportRecruitmentUpdateError> {
    let newTitle = this._title;
    if (input.title !== undefined) {
      const title = normalizeTitle(input.title);
      if (!title.ok) return title;
      newTitle = title.value;
    }

    let newDescription = this._description;
    if (input.description !== undefined) {
      const description = normalizeDescription(input.description);
      if (!description.ok) return description;
      newDescription = description.value;
    }

    this._title = newTitle;
    this._description = newDescription;
    this._updatedAt = new Date();
    return ok(undefined);
  }

  // ---- Schedules ----

  /**
   * 日程を追加する。同じ日付の日程がすでにあればエラー。
   *
   * 追加した日程を返す（リポジトリの `addSchedule()` に渡して保存する）。
   */
  addSchedule(input: {
    date: ScheduleDate;
    timeRange: TimeRange;
    capacityPerHour: CapacityPerHour;
    approvalMode: ApprovalMode;
  }): Result<RecruitmentSchedule, RecruitmentScheduleError> {
    if (this.hasScheduleOn(input.date)) {
      return err({ type: "DUPLICATE_SCHEDULE_DATE", date: input.date.toString() });
    }
    const schedule = RecruitmentSchedule.create({ supportRecruitmentId: this._id, ...input });
    this._schedules = sortByDate([...this._schedules, schedule]);
    return ok(schedule);
  }

  /**
   * 日程を変更する。日程が無い、または変更後の日付が他の日程と重なるとエラー。
   *
   * 変更後の日程を返す（リポジトリの `updateSchedule()` に渡して保存する）。
   */
  updateSchedule(
    scheduleId: RecruitmentScheduleId,
    changes: RecruitmentScheduleChanges
  ): Result<RecruitmentSchedule, RecruitmentScheduleError> {
    const current = this._schedules.find((s) => s.id.equals(scheduleId));
    if (!current) {
      return err({ type: "SCHEDULE_NOT_FOUND", scheduleId: scheduleId.toString() });
    }
    if (changes.date !== undefined && this.hasScheduleOn(changes.date, scheduleId)) {
      return err({ type: "DUPLICATE_SCHEDULE_DATE", date: changes.date.toString() });
    }
    const updated = current.withChanges(changes);
    this._schedules = sortByDate(
      this._schedules.map((s) => (s.id.equals(scheduleId) ? updated : s))
    );
    return ok(updated);
  }

  /**
   * 日程を削除する。日程が無ければエラー。
   *
   * 削除した日程を返す（リポジトリの `removeSchedule()` に渡して保存する）。
   */
  removeSchedule(
    scheduleId: RecruitmentScheduleId
  ): Result<RecruitmentSchedule, RecruitmentScheduleError> {
    const removed = this._schedules.find((s) => s.id.equals(scheduleId));
    if (!removed) {
      return err({ type: "SCHEDULE_NOT_FOUND", scheduleId: scheduleId.toString() });
    }
    this._schedules = this._schedules.filter((s) => !s.id.equals(scheduleId));
    return ok(removed);
  }

  // ---- Private helpers ----

  /**
   * 指定した日付の日程があるか。`excludeId` の日程は数えない（自分自身の日付を変えないとき用）。
   */
  private hasScheduleOn(date: ScheduleDate, excludeId?: RecruitmentScheduleId): boolean {
    return this._schedules.some(
      (s) => s.date.equals(date) && !(excludeId !== undefined && s.id.equals(excludeId))
    );
  }
}

function normalizeTitle(value: string): Result<string, SupportRecruitmentUpdateError> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return err({ type: "TITLE_REQUIRED" });
  }
  if (trimmed.length > LIMITS.title) {
    return err({ type: "TITLE_TOO_LONG", maxLength: LIMITS.title, actualLength: trimmed.length });
  }
  return ok(trimmed);
}

function normalizeDescription(value: string): Result<string, SupportRecruitmentUpdateError> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return err({ type: "DESCRIPTION_REQUIRED" });
  }
  if (trimmed.length > LIMITS.description) {
    return err({
      type: "DESCRIPTION_TOO_LONG",
      maxLength: LIMITS.description,
      actualLength: trimmed.length,
    });
  }
  return ok(trimmed);
}

/**
 * 日程を日付の古い順に並べる（"YYYY-MM-DD" は文字列の大小がそのまま日付の前後になる）。
 */
function sortByDate(schedules: readonly RecruitmentSchedule[]): readonly RecruitmentSchedule[] {
  return [...schedules].sort((a, b) => {
    const left = a.date.toString();
    const right = b.date.toString();
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });
}

export const SUPPORT_RECRUITMENT_LIMITS = LIMITS;
