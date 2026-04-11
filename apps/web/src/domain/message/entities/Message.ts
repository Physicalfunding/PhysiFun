import { type Result, type AppError, ok, err, validationError } from "../../shared/result";
import { MessageId } from "../value-objects/MessageId";
import { UserId } from "../../account/value-objects/UserId";

interface CreateMessageInput {
  id: MessageId;
  senderId: UserId;
  receiverId: UserId;
  subject: string;
  body: string;
  parentMessageId?: MessageId | null;
}

interface ReconstructMessageInput {
  id: MessageId;
  senderId: UserId;
  receiverId: UserId;
  subject: string;
  body: string;
  isRead: boolean;
  parentMessageId: MessageId | null;
  createdAt: Date;
  readAt: Date | null;
}

/**
 * Message entity
 * Represents a message between users
 */
export class Message {
  private constructor(
    private readonly _id: MessageId,
    private readonly _senderId: UserId,
    private readonly _receiverId: UserId,
    private readonly _subject: string,
    private readonly _body: string,
    private _isRead: boolean,
    private readonly _parentMessageId: MessageId | null,
    private readonly _createdAt: Date,
    private _readAt: Date | null
  ) {}

  get id(): MessageId {
    return this._id;
  }

  get senderId(): UserId {
    return this._senderId;
  }

  get receiverId(): UserId {
    return this._receiverId;
  }

  get subject(): string {
    return this._subject;
  }

  get body(): string {
    return this._body;
  }

  get isRead(): boolean {
    return this._isRead;
  }

  get parentMessageId(): MessageId | null {
    return this._parentMessageId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get readAt(): Date | null {
    return this._readAt;
  }

  /**
   * Creates a new Message entity
   */
  static create(input: CreateMessageInput): Result<Message, AppError> {
    const subject = input.subject.trim();
    const body = input.body.trim();

    if (!subject) {
      return err(validationError("件名を入力してください"));
    }

    if (!body) {
      return err(validationError("本文を入力してください"));
    }

    if (input.senderId.equals(input.receiverId)) {
      return err(validationError("自分自身にメッセージを送信することはできません"));
    }

    const now = new Date();
    return ok(
      new Message(
        input.id,
        input.senderId,
        input.receiverId,
        subject,
        body,
        false,
        input.parentMessageId ?? null,
        now,
        null
      )
    );
  }

  /**
   * Reconstructs a Message from persisted data
   */
  static reconstruct(input: ReconstructMessageInput): Message {
    return new Message(
      input.id,
      input.senderId,
      input.receiverId,
      input.subject,
      input.body,
      input.isRead,
      input.parentMessageId,
      input.createdAt,
      input.readAt
    );
  }

  /**
   * Marks the message as read
   */
  markAsRead(): Message {
    if (this._isRead) {
      return this;
    }

    return new Message(
      this._id,
      this._senderId,
      this._receiverId,
      this._subject,
      this._body,
      true,
      this._parentMessageId,
      this._createdAt,
      new Date()
    );
  }

  /**
   * Checks if this message is a reply
   */
  isReply(): boolean {
    return this._parentMessageId !== null;
  }
}
