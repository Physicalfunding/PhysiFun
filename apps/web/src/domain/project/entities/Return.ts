import { type Result, type AppError, ok, err, validationError } from "../../shared/result";
import { ReturnId } from "../value-objects/ReturnId";
import { ProjectId } from "../value-objects/ProjectId";

interface CreateReturnInput {
  id: ReturnId;
  projectId: ProjectId;
  name: string;
  description: string;
  estimatedDeliveryDate?: Date | null;
  quantityLimit?: number | null;
  order?: number;
}

interface ReconstructReturnInput {
  id: ReturnId;
  projectId: ProjectId;
  name: string;
  description: string;
  estimatedDeliveryDate: Date | null;
  quantityLimit: number | null;
  order: number;
  createdAt: Date;
}

interface UpdateReturnInput {
  name?: string;
  description?: string;
  estimatedDeliveryDate?: Date | null;
  quantityLimit?: number | null;
  order?: number;
}

/**
 * Return entity
 * Represents a reward/return for participants
 */
export class Return {
  private constructor(
    private readonly _id: ReturnId,
    private readonly _projectId: ProjectId,
    private _name: string,
    private _description: string,
    private _estimatedDeliveryDate: Date | null,
    private _quantityLimit: number | null,
    private _order: number,
    private readonly _createdAt: Date
  ) {}

  get id(): ReturnId {
    return this._id;
  }

  get projectId(): ProjectId {
    return this._projectId;
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get estimatedDeliveryDate(): Date | null {
    return this._estimatedDeliveryDate;
  }

  get quantityLimit(): number | null {
    return this._quantityLimit;
  }

  get order(): number {
    return this._order;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Creates a new Return entity
   */
  static create(input: CreateReturnInput): Result<Return, AppError> {
    const name = input.name.trim();
    const description = input.description.trim();

    if (!name) {
      return err(validationError("リターン名を入力してください"));
    }

    if (!description) {
      return err(validationError("リターンの説明を入力してください"));
    }

    const now = new Date();
    return ok(
      new Return(
        input.id,
        input.projectId,
        name,
        description,
        input.estimatedDeliveryDate ?? null,
        input.quantityLimit ?? null,
        input.order ?? 0,
        now
      )
    );
  }

  /**
   * Reconstructs a Return from persisted data
   */
  static reconstruct(input: ReconstructReturnInput): Return {
    return new Return(
      input.id,
      input.projectId,
      input.name,
      input.description,
      input.estimatedDeliveryDate,
      input.quantityLimit,
      input.order,
      input.createdAt
    );
  }

  /**
   * Updates return information
   */
  update(input: UpdateReturnInput): Result<Return, AppError> {
    const name = input.name !== undefined ? input.name.trim() : this._name;
    const description =
      input.description !== undefined ? input.description.trim() : this._description;

    if (!name) {
      return err(validationError("リターン名を入力してください"));
    }

    if (!description) {
      return err(validationError("リターンの説明を入力してください"));
    }

    return ok(
      new Return(
        this._id,
        this._projectId,
        name,
        description,
        input.estimatedDeliveryDate !== undefined
          ? input.estimatedDeliveryDate
          : this._estimatedDeliveryDate,
        input.quantityLimit !== undefined ? input.quantityLimit : this._quantityLimit,
        input.order !== undefined ? input.order : this._order,
        this._createdAt
      )
    );
  }

  /**
   * Checks if this return has a quantity limit
   */
  hasQuantityLimit(): boolean {
    return this._quantityLimit !== null;
  }
}
