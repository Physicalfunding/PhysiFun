import type { ApprovalMode } from "../value-objects/ApprovalMode";
import type { CapacityPerHour } from "../value-objects/CapacityPerHour";
import { RecruitmentScheduleId } from "../value-objects/RecruitmentScheduleId";
import type { ScheduleDate } from "../value-objects/ScheduleDate";
import type { SupportRecruitmentId } from "../value-objects/SupportRecruitmentId";
import type { TimeRange } from "../value-objects/TimeRange";

/**
 * 日程の変更内容（指定した項目だけ変える）
 */
export interface RecruitmentScheduleChanges {
  readonly date?: ScheduleDate;
  readonly timeRange?: TimeRange;
  readonly capacityPerHour?: CapacityPerHour;
  readonly approvalMode?: ApprovalMode;
}

/**
 * RecruitmentSchedule エンティティ（SupportRecruitment 集約の子）
 *
 * サポート募集の 1 日分の日程。その日の受付時間帯・1 時間ごとの定員・承認モードを持つ。
 *
 * - 追加・変更・削除は集約ルートの `SupportRecruitment`（addSchedule / updateSchedule / removeSchedule）
 *   から行う。「1 募集につき 1 日 1 日程」をルートが検証するため
 * - 書き換えできない。変更は `withChanges()` で新しいインスタンスを作り、ルートが差し替える
 *   （外から直接書き換えて、ルートの検証をすり抜けられないようにするため）
 */
export class RecruitmentSchedule {
  private constructor(
    private readonly _id: RecruitmentScheduleId,
    private readonly _supportRecruitmentId: SupportRecruitmentId,
    private readonly _date: ScheduleDate,
    private readonly _timeRange: TimeRange,
    private readonly _capacityPerHour: CapacityPerHour,
    private readonly _approvalMode: ApprovalMode,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date
  ) {}

  /**
   * 新しい日程を作る。`SupportRecruitment.addSchedule()` から呼ぶ。
   *
   * 入力はすべて検証済みの値オブジェクトなので、失敗しない。
   */
  static create(input: {
    supportRecruitmentId: SupportRecruitmentId;
    date: ScheduleDate;
    timeRange: TimeRange;
    capacityPerHour: CapacityPerHour;
    approvalMode: ApprovalMode;
    id?: RecruitmentScheduleId;
    createdAt?: Date;
  }): RecruitmentSchedule {
    const now = input.createdAt ?? new Date();
    return new RecruitmentSchedule(
      input.id ?? RecruitmentScheduleId.generate(),
      input.supportRecruitmentId,
      input.date,
      input.timeRange,
      input.capacityPerHour,
      input.approvalMode,
      now,
      now
    );
  }

  /**
   * 永続化層からの復元。
   */
  static reconstruct(input: {
    id: RecruitmentScheduleId;
    supportRecruitmentId: SupportRecruitmentId;
    date: ScheduleDate;
    timeRange: TimeRange;
    capacityPerHour: CapacityPerHour;
    approvalMode: ApprovalMode;
    createdAt: Date;
    updatedAt: Date;
  }): RecruitmentSchedule {
    return new RecruitmentSchedule(
      input.id,
      input.supportRecruitmentId,
      input.date,
      input.timeRange,
      input.capacityPerHour,
      input.approvalMode,
      input.createdAt,
      input.updatedAt
    );
  }

  get id(): RecruitmentScheduleId {
    return this._id;
  }
  get supportRecruitmentId(): SupportRecruitmentId {
    return this._supportRecruitmentId;
  }
  get date(): ScheduleDate {
    return this._date;
  }
  get timeRange(): TimeRange {
    return this._timeRange;
  }
  get capacityPerHour(): CapacityPerHour {
    return this._capacityPerHour;
  }
  get approvalMode(): ApprovalMode {
    return this._approvalMode;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * 変更を反映した新しい日程を返す（自分自身は変えない）。`SupportRecruitment.updateSchedule()` から呼ぶ。
   *
   * id / supportRecruitmentId / createdAt は引き継ぎ、updatedAt は現在時刻にする。
   */
  withChanges(changes: RecruitmentScheduleChanges): RecruitmentSchedule {
    return new RecruitmentSchedule(
      this._id,
      this._supportRecruitmentId,
      changes.date ?? this._date,
      changes.timeRange ?? this._timeRange,
      changes.capacityPerHour ?? this._capacityPerHour,
      changes.approvalMode ?? this._approvalMode,
      this._createdAt,
      new Date()
    );
  }
}
