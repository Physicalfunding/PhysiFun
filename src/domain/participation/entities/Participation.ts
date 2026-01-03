import { type Result, type AppError, ok, err, validationError } from "../../shared/result";
import { ParticipationId } from "../value-objects/ParticipationId";
import { UserId } from "../../account/value-objects/UserId";
import { ScheduleId } from "../../schedule/value-objects/ScheduleId";

/**
 * Participation status enumeration
 */
export const ParticipationStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
} as const;

export type ParticipationStatus = (typeof ParticipationStatus)[keyof typeof ParticipationStatus];

interface CreateParticipationInput {
  id: ParticipationId;
  guestId: UserId;
  scheduleId: ScheduleId;
  participantCount: number;
}

interface ReconstructParticipationInput {
  id: ParticipationId;
  guestId: UserId;
  scheduleId: ScheduleId;
  participantCount: number;
  status: ParticipationStatus;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Participation entity
 * Represents a guest's participation in a schedule
 */
export class Participation {
  private constructor(
    private readonly _id: ParticipationId,
    private readonly _guestId: UserId,
    private readonly _scheduleId: ScheduleId,
    private readonly _participantCount: number,
    private _status: ParticipationStatus,
    private readonly _appliedAt: Date,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  get id(): ParticipationId {
    return this._id;
  }

  get guestId(): UserId {
    return this._guestId;
  }

  get scheduleId(): ScheduleId {
    return this._scheduleId;
  }

  get participantCount(): number {
    return this._participantCount;
  }

  get status(): ParticipationStatus {
    return this._status;
  }

  get appliedAt(): Date {
    return this._appliedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Creates a new Participation entity
   */
  static create(input: CreateParticipationInput): Result<Participation, AppError> {
    if (input.participantCount <= 0) {
      return err(validationError("参加人数は1以上で指定してください"));
    }

    const now = new Date();
    return ok(
      new Participation(
        input.id,
        input.guestId,
        input.scheduleId,
        input.participantCount,
        ParticipationStatus.PENDING,
        now,
        now,
        now
      )
    );
  }

  /**
   * Reconstructs a Participation from persisted data
   */
  static reconstruct(input: ReconstructParticipationInput): Participation {
    return new Participation(
      input.id,
      input.guestId,
      input.scheduleId,
      input.participantCount,
      input.status,
      input.appliedAt,
      input.createdAt,
      input.updatedAt
    );
  }

  /**
   * Confirms the participation
   */
  confirm(): Result<Participation, AppError> {
    if (this._status === ParticipationStatus.CONFIRMED) {
      return err(validationError("この参加申し込みは既に確認済みです"));
    }

    if (this._status === ParticipationStatus.CANCELLED) {
      return err(validationError("キャンセル済みの参加申し込みは確認できません"));
    }

    return ok(
      new Participation(
        this._id,
        this._guestId,
        this._scheduleId,
        this._participantCount,
        ParticipationStatus.CONFIRMED,
        this._appliedAt,
        this._createdAt,
        new Date()
      )
    );
  }

  /**
   * Cancels the participation
   */
  cancel(): Result<Participation, AppError> {
    if (this._status === ParticipationStatus.CANCELLED) {
      return err(validationError("この参加申し込みは既にキャンセル済みです"));
    }

    return ok(
      new Participation(
        this._id,
        this._guestId,
        this._scheduleId,
        this._participantCount,
        ParticipationStatus.CANCELLED,
        this._appliedAt,
        this._createdAt,
        new Date()
      )
    );
  }

  /**
   * Checks if the participation is pending
   */
  isPending(): boolean {
    return this._status === ParticipationStatus.PENDING;
  }

  /**
   * Checks if the participation is active (not cancelled)
   */
  isActive(): boolean {
    return this._status !== ParticipationStatus.CANCELLED;
  }
}
