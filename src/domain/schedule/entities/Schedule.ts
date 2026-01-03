import { type Result, type AppError, ok, err, validationError } from "../../shared/result";
import { ScheduleId } from "../value-objects/ScheduleId";
import { ProjectId } from "../../project/value-objects/ProjectId";

interface CreateScheduleInput {
  id: ScheduleId;
  projectId: ProjectId;
  title: string;
  description: string;
  startDateTime: Date;
  duration?: number | null;
  capacity: number;
  requirements?: string | null;
}

interface ReconstructScheduleInput {
  id: ScheduleId;
  projectId: ProjectId;
  title: string;
  description: string;
  startDateTime: Date;
  duration: number | null;
  capacity: number;
  requirements: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateScheduleInput {
  title?: string;
  description?: string;
  startDateTime?: Date;
  duration?: number | null;
  capacity?: number;
  requirements?: string | null;
}

/**
 * Schedule entity
 * Represents an experience schedule for a project
 */
export class Schedule {
  private constructor(
    private readonly _id: ScheduleId,
    private readonly _projectId: ProjectId,
    private _title: string,
    private _description: string,
    private _startDateTime: Date,
    private _duration: number | null,
    private _capacity: number,
    private _requirements: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  get id(): ScheduleId {
    return this._id;
  }

  get projectId(): ProjectId {
    return this._projectId;
  }

  get title(): string {
    return this._title;
  }

  get description(): string {
    return this._description;
  }

  get startDateTime(): Date {
    return this._startDateTime;
  }

  get duration(): number | null {
    return this._duration;
  }

  get capacity(): number {
    return this._capacity;
  }

  get requirements(): string | null {
    return this._requirements;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Creates a new Schedule entity
   */
  static create(input: CreateScheduleInput): Result<Schedule, AppError> {
    const title = input.title.trim();
    const description = input.description.trim();

    if (!title) {
      return err(validationError("体験タイトルを入力してください"));
    }

    if (!description) {
      return err(validationError("体験内容を入力してください"));
    }

    if (input.startDateTime <= new Date()) {
      return err(validationError("開催日時は未来の日時を設定してください"));
    }

    if (input.capacity <= 0) {
      return err(validationError("募集人数は1以上で設定してください"));
    }

    const now = new Date();
    return ok(
      new Schedule(
        input.id,
        input.projectId,
        title,
        description,
        input.startDateTime,
        input.duration ?? null,
        input.capacity,
        input.requirements ?? null,
        now,
        now
      )
    );
  }

  /**
   * Reconstructs a Schedule from persisted data
   */
  static reconstruct(input: ReconstructScheduleInput): Schedule {
    return new Schedule(
      input.id,
      input.projectId,
      input.title,
      input.description,
      input.startDateTime,
      input.duration,
      input.capacity,
      input.requirements,
      input.createdAt,
      input.updatedAt
    );
  }

  /**
   * Updates schedule information
   */
  update(input: UpdateScheduleInput): Result<Schedule, AppError> {
    const title = input.title !== undefined ? input.title.trim() : this._title;
    const description = input.description !== undefined ? input.description.trim() : this._description;
    const startDateTime = input.startDateTime ?? this._startDateTime;
    const capacity = input.capacity ?? this._capacity;

    if (!title) {
      return err(validationError("体験タイトルを入力してください"));
    }

    if (!description) {
      return err(validationError("体験内容を入力してください"));
    }

    if (startDateTime <= new Date()) {
      return err(validationError("開催日時は未来の日時を設定してください"));
    }

    if (capacity <= 0) {
      return err(validationError("募集人数は1以上で設定してください"));
    }

    return ok(
      new Schedule(
        this._id,
        this._projectId,
        title,
        description,
        startDateTime,
        input.duration !== undefined ? input.duration : this._duration,
        capacity,
        input.requirements !== undefined ? input.requirements : this._requirements,
        this._createdAt,
        new Date()
      )
    );
  }

  /**
   * Checks if there is capacity for the given number of participants
   */
  hasCapacity(currentParticipants: number): boolean {
    return currentParticipants <= this._capacity;
  }

  /**
   * Checks if the schedule is in the past
   */
  isPast(): boolean {
    return this._startDateTime < new Date();
  }
}
