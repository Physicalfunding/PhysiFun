import { type Result, type AppError, ok, err, validationError } from "../../shared/result";
import { Email } from "../value-objects/Email";
import { HashedPassword } from "../value-objects/Password";
import { UserId } from "../value-objects/UserId";

/**
 * User type enumeration
 */
export const UserType = {
  HOST: "HOST",
  GUEST: "GUEST",
  BOTH: "BOTH",
} as const;

export type UserType = (typeof UserType)[keyof typeof UserType];

interface CreateUserInput {
  id: UserId;
  email: Email;
  passwordHash: HashedPassword;
  name: string;
  userType: UserType;
  bio?: string | null;
  avatarUrl?: string | null;
}

interface ReconstructUserInput {
  id: UserId;
  email: Email;
  passwordHash: HashedPassword;
  name: string;
  userType: UserType;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateProfileInput {
  name?: string;
  bio?: string | null;
  userType?: UserType;
}

/**
 * User entity
 * Represents a user in the system
 */
export class User {
  private constructor(
    private readonly _id: UserId,
    private readonly _email: Email,
    private readonly _passwordHash: HashedPassword,
    private _name: string,
    private _userType: UserType,
    private _bio: string | null,
    private _avatarUrl: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  get id(): UserId {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get passwordHash(): HashedPassword {
    return this._passwordHash;
  }

  get name(): string {
    return this._name;
  }

  get userType(): UserType {
    return this._userType;
  }

  get bio(): string | null {
    return this._bio;
  }

  get avatarUrl(): string | null {
    return this._avatarUrl;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Creates a new User entity
   */
  static create(input: CreateUserInput): Result<User, AppError> {
    const name = input.name.trim();

    if (!name) {
      return err(validationError("名前を入力してください"));
    }

    const now = new Date();
    return ok(
      new User(
        input.id,
        input.email,
        input.passwordHash,
        name,
        input.userType,
        input.bio ?? null,
        input.avatarUrl ?? null,
        now,
        now
      )
    );
  }

  /**
   * Reconstructs a User from persisted data
   */
  static reconstruct(input: ReconstructUserInput): User {
    return new User(
      input.id,
      input.email,
      input.passwordHash,
      input.name,
      input.userType,
      input.bio,
      input.avatarUrl,
      input.createdAt,
      input.updatedAt
    );
  }

  /**
   * Updates the user's profile
   */
  updateProfile(input: UpdateProfileInput): Result<User, AppError> {
    const name = input.name !== undefined ? input.name.trim() : this._name;

    if (!name) {
      return err(validationError("名前を入力してください"));
    }

    return ok(
      new User(
        this._id,
        this._email,
        this._passwordHash,
        name,
        input.userType ?? this._userType,
        input.bio !== undefined ? input.bio : this._bio,
        this._avatarUrl,
        this._createdAt,
        new Date()
      )
    );
  }

  /**
   * Updates the user's avatar
   */
  updateAvatar(avatarUrl: string): User {
    return new User(
      this._id,
      this._email,
      this._passwordHash,
      this._name,
      this._userType,
      this._bio,
      avatarUrl,
      this._createdAt,
      new Date()
    );
  }

  /**
   * Checks if the user can act as a host
   */
  isHost(): boolean {
    return this._userType === UserType.HOST || this._userType === UserType.BOTH;
  }

  /**
   * Checks if the user can act as a guest
   */
  isGuest(): boolean {
    return this._userType === UserType.GUEST || this._userType === UserType.BOTH;
  }
}
