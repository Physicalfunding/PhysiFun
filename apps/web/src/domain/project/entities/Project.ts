import { type Result, type AppError, ok, err, validationError } from "../../shared/result";
import { ProjectId } from "../value-objects/ProjectId";
import { UserId } from "../../account/value-objects/UserId";

/**
 * Project status enumeration
 */
export const ProjectStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

/**
 * Project category enumeration
 */
export const Category = {
  KOMINKA: "KOMINKA",
  RICE_FARMING: "RICE_FARMING",
  DIY: "DIY",
  CRAFT: "CRAFT",
  OTHER: "OTHER",
} as const;

export type Category = (typeof Category)[keyof typeof Category];

interface CreateProjectInput {
  id: ProjectId;
  hostId: UserId;
  title: string;
  summary: string;
  description: string;
  category: Category;
  location: string;
  imageUrls?: string[];
}

interface ReconstructProjectInput {
  id: ProjectId;
  hostId: UserId;
  title: string;
  summary: string;
  description: string;
  category: Category;
  location: string;
  imageUrls: string[];
  status: ProjectStatus;
  slug: string | null;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

interface UpdateProjectInput {
  title?: string;
  summary?: string;
  description?: string;
  category?: Category;
  location?: string;
}

/**
 * Project entity
 * Represents a project created by a host
 */
export class Project {
  private constructor(
    private readonly _id: ProjectId,
    private readonly _hostId: UserId,
    private _title: string,
    private _summary: string,
    private _description: string,
    private _category: Category,
    private _location: string,
    private _imageUrls: string[],
    private _status: ProjectStatus,
    private _slug: string | null,
    private _isFeatured: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _publishedAt: Date | null
  ) {}

  get id(): ProjectId {
    return this._id;
  }

  get hostId(): UserId {
    return this._hostId;
  }

  get title(): string {
    return this._title;
  }

  get summary(): string {
    return this._summary;
  }

  get description(): string {
    return this._description;
  }

  get category(): Category {
    return this._category;
  }

  get location(): string {
    return this._location;
  }

  get imageUrls(): string[] {
    return [...this._imageUrls];
  }

  get status(): ProjectStatus {
    return this._status;
  }

  get slug(): string | null {
    return this._slug;
  }

  get isFeatured(): boolean {
    return this._isFeatured;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get publishedAt(): Date | null {
    return this._publishedAt;
  }

  /**
   * Creates a new Project entity (starts as DRAFT)
   */
  static create(input: CreateProjectInput): Result<Project, AppError> {
    const title = input.title.trim();
    const summary = input.summary.trim();
    const description = input.description.trim();

    if (!title) {
      return err(validationError("タイトルを入力してください"));
    }

    if (!summary) {
      return err(validationError("概要を入力してください"));
    }

    if (!description) {
      return err(validationError("詳細説明を入力してください"));
    }

    const now = new Date();
    return ok(
      new Project(
        input.id,
        input.hostId,
        title,
        summary,
        description,
        input.category,
        input.location,
        input.imageUrls ?? [],
        ProjectStatus.DRAFT,
        null,
        false,
        now,
        now,
        null
      )
    );
  }

  /**
   * Reconstructs a Project from persisted data
   */
  static reconstruct(input: ReconstructProjectInput): Project {
    return new Project(
      input.id,
      input.hostId,
      input.title,
      input.summary,
      input.description,
      input.category,
      input.location,
      input.imageUrls,
      input.status,
      input.slug,
      input.isFeatured,
      input.createdAt,
      input.updatedAt,
      input.publishedAt
    );
  }

  /**
   * Publishes the project
   */
  publish(): Result<Project, AppError> {
    if (this._status === ProjectStatus.PUBLISHED) {
      return err(validationError("このプロジェクトは既に公開済みです"));
    }

    const now = new Date();
    const slug = this.generateSlug();

    return ok(
      new Project(
        this._id,
        this._hostId,
        this._title,
        this._summary,
        this._description,
        this._category,
        this._location,
        this._imageUrls,
        ProjectStatus.PUBLISHED,
        slug,
        this._isFeatured,
        this._createdAt,
        now,
        now
      )
    );
  }

  /**
   * Unpublishes the project (returns to DRAFT)
   */
  unpublish(): Result<Project, AppError> {
    if (this._status === ProjectStatus.DRAFT) {
      return err(validationError("このプロジェクトは既に下書き状態です"));
    }

    return ok(
      new Project(
        this._id,
        this._hostId,
        this._title,
        this._summary,
        this._description,
        this._category,
        this._location,
        this._imageUrls,
        ProjectStatus.DRAFT,
        this._slug,
        this._isFeatured,
        this._createdAt,
        new Date(),
        this._publishedAt
      )
    );
  }

  /**
   * Updates project information
   */
  update(input: UpdateProjectInput): Result<Project, AppError> {
    const title = input.title !== undefined ? input.title.trim() : this._title;
    const summary = input.summary !== undefined ? input.summary.trim() : this._summary;
    const description =
      input.description !== undefined ? input.description.trim() : this._description;

    if (!title) {
      return err(validationError("タイトルを入力してください"));
    }

    if (!summary) {
      return err(validationError("概要を入力してください"));
    }

    if (!description) {
      return err(validationError("詳細説明を入力してください"));
    }

    return ok(
      new Project(
        this._id,
        this._hostId,
        title,
        summary,
        description,
        input.category ?? this._category,
        input.location ?? this._location,
        this._imageUrls,
        this._status,
        this._slug,
        this._isFeatured,
        this._createdAt,
        new Date(),
        this._publishedAt
      )
    );
  }

  /**
   * Updates image URLs
   */
  updateImages(imageUrls: string[]): Project {
    return new Project(
      this._id,
      this._hostId,
      this._title,
      this._summary,
      this._description,
      this._category,
      this._location,
      imageUrls,
      this._status,
      this._slug,
      this._isFeatured,
      this._createdAt,
      new Date(),
      this._publishedAt
    );
  }

  /**
   * Checks if the project is published
   */
  isPublished(): boolean {
    return this._status === ProjectStatus.PUBLISHED;
  }

  /**
   * Generates a URL slug from the title
   */
  private generateSlug(): string {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `${this._title}-${randomSuffix}`;
  }
}
