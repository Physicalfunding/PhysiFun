import { Message } from "../entities/Message";
import { MessageId } from "../value-objects/MessageId";
import { UserId } from "../../account/value-objects/UserId";

/**
 * MessageRepository interface
 * メッセージエンティティの永続化を抽象化するリポジトリインターフェース
 */
export interface MessageRepository {
  /**
   * IDでメッセージを検索
   */
  findById(id: MessageId): Promise<Message | null>;

  /**
   * ユーザーの受信メッセージ一覧を取得
   */
  findByReceiverId(receiverId: UserId): Promise<Message[]>;

  /**
   * ユーザーの送信メッセージ一覧を取得
   */
  findBySenderId(senderId: UserId): Promise<Message[]>;

  /**
   * メッセージスレッドを取得（親メッセージとその返信）
   */
  findThread(parentMessageId: MessageId): Promise<Message[]>;

  /**
   * 新規メッセージを作成
   */
  create(message: Message): Promise<Message>;

  /**
   * メッセージを更新（既読状態の更新など）
   */
  update(message: Message): Promise<Message>;

  /**
   * ユーザーの未読メッセージ数をカウント
   */
  countUnread(userId: UserId): Promise<number>;
}
