import { type Result, type AppError, ok, err, validationError } from "../../shared/result";
import { EntryId } from "../value-objects/EntryId";

/**
 * 応募ステータス
 */
export const EntryStatus = {
  PENDING: "PENDING", // 審査待ち
  REVIEWING: "REVIEWING", // 審査中
  APPROVED: "APPROVED", // 承認
  REJECTED: "REJECTED", // 却下
} as const;

export type EntryStatus = (typeof EntryStatus)[keyof typeof EntryStatus];

/**
 * 新規応募作成時の入力
 */
interface CreateEntryInput {
  id: EntryId;
  name: string;
  email: string;
  projectTitle: string;
  projectSummary: string;
  projectStory: string;
}

/**
 * DBから復元する際の入力
 */
interface ReconstructEntryInput {
  id: EntryId;
  name: string;
  email: string;
  projectTitle: string;
  projectSummary: string;
  projectStory: string;
  status: EntryStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OwnerEntry エンティティ
 * オーナー応募を表すドメインエンティティ
 */
export class OwnerEntry {
  private constructor(
    private readonly _id: EntryId,
    private readonly _name: string,
    private readonly _email: string,
    private readonly _projectTitle: string,
    private readonly _projectSummary: string,
    private readonly _projectStory: string,
    private readonly _status: EntryStatus,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date
  ) {}

  get id(): EntryId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get email(): string {
    return this._email;
  }

  get projectTitle(): string {
    return this._projectTitle;
  }

  get projectSummary(): string {
    return this._projectSummary;
  }

  get projectStory(): string {
    return this._projectStory;
  }

  get status(): EntryStatus {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * 新規応募を作成（ステータスは PENDING）
   */
  static create(input: CreateEntryInput): Result<OwnerEntry, AppError> {
    const name = input.name.trim();
    const email = input.email.trim();
    const projectTitle = input.projectTitle.trim();
    const projectSummary = input.projectSummary.trim();
    const projectStory = input.projectStory.trim();

    // バリデーション
    if (!name) {
      return err(validationError("お名前を入力してください"));
    }

    if (!email) {
      return err(validationError("メールアドレスを入力してください"));
    }

    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return err(validationError("有効なメールアドレスを入力してください"));
    }

    if (!projectTitle) {
      return err(validationError("プロジェクトタイトルを入力してください"));
    }

    if (!projectSummary) {
      return err(validationError("プロジェクト概要を入力してください"));
    }

    if (!projectStory) {
      return err(validationError("プロジェクト説明を入力してください"));
    }

    const now = new Date();
    return ok(
      new OwnerEntry(
        input.id,
        name,
        email,
        projectTitle,
        projectSummary,
        projectStory,
        EntryStatus.PENDING,
        now,
        now
      )
    );
  }

  /**
   * DBから復元
   */
  static reconstruct(input: ReconstructEntryInput): OwnerEntry {
    return new OwnerEntry(
      input.id,
      input.name,
      input.email,
      input.projectTitle,
      input.projectSummary,
      input.projectStory,
      input.status,
      input.createdAt,
      input.updatedAt
    );
  }

  /**
   * 審査待ちかどうか
   */
  isPending(): boolean {
    return this._status === EntryStatus.PENDING;
  }

  /**
   * 承認済みかどうか
   */
  isApproved(): boolean {
    return this._status === EntryStatus.APPROVED;
  }
}
