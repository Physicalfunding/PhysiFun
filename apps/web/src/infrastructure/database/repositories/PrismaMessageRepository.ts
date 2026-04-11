import { PrismaClient, Message as PrismaMessage } from "@prisma/client";
import { Message } from "@/domain/message/entities/Message";
import { MessageRepository } from "@/domain/message/repositories/MessageRepository";
import { MessageId } from "@/domain/message/value-objects/MessageId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * PrismaMessageRepository
 * MessageRepositoryインターフェースのPrisma実装
 */
export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * IDでメッセージを検索
   */
  async findById(id: MessageId): Promise<Message | null> {
    const prismaMessage = await this.prisma.message.findUnique({
      where: { id: id.value },
    });

    if (!prismaMessage) {
      return null;
    }

    return this.toDomain(prismaMessage);
  }

  /**
   * ユーザーの受信メッセージ一覧を取得
   */
  async findByReceiverId(receiverId: UserId): Promise<Message[]> {
    const prismaMessages = await this.prisma.message.findMany({
      where: { receiverId: receiverId.value },
      orderBy: { createdAt: "desc" },
    });

    return prismaMessages.map((m) => this.toDomain(m));
  }

  /**
   * ユーザーの送信メッセージ一覧を取得
   */
  async findBySenderId(senderId: UserId): Promise<Message[]> {
    const prismaMessages = await this.prisma.message.findMany({
      where: { senderId: senderId.value },
      orderBy: { createdAt: "desc" },
    });

    return prismaMessages.map((m) => this.toDomain(m));
  }

  /**
   * メッセージスレッドを取得（親メッセージとその返信）
   */
  async findThread(parentMessageId: MessageId): Promise<Message[]> {
    const prismaMessages = await this.prisma.message.findMany({
      where: {
        OR: [{ id: parentMessageId.value }, { parentMessageId: parentMessageId.value }],
      },
      orderBy: { createdAt: "asc" },
    });

    return prismaMessages.map((m) => this.toDomain(m));
  }

  /**
   * 新規メッセージを作成
   */
  async create(message: Message): Promise<Message> {
    const prismaMessage = await this.prisma.message.create({
      data: {
        id: message.id.value,
        senderId: message.senderId.value,
        receiverId: message.receiverId.value,
        subject: message.subject,
        body: message.body,
        isRead: message.isRead,
        parentMessageId: message.parentMessageId?.value ?? null,
        readAt: message.readAt,
      },
    });

    return this.toDomain(prismaMessage);
  }

  /**
   * メッセージを更新
   */
  async update(message: Message): Promise<Message> {
    const prismaMessage = await this.prisma.message.update({
      where: { id: message.id.value },
      data: {
        isRead: message.isRead,
        readAt: message.readAt,
      },
    });

    return this.toDomain(prismaMessage);
  }

  /**
   * ユーザーの未読メッセージ数をカウント
   */
  async countUnread(userId: UserId): Promise<number> {
    return this.prisma.message.count({
      where: {
        receiverId: userId.value,
        isRead: false,
      },
    });
  }

  /**
   * Prismaモデルからドメインエンティティへのマッピング
   */
  private toDomain(prismaMessage: PrismaMessage): Message {
    const messageIdResult = MessageId.create(prismaMessage.id);
    if (!messageIdResult.success) {
      throw new Error(`Invalid messageId in database: ${prismaMessage.id}`);
    }

    const senderIdResult = UserId.create(prismaMessage.senderId);
    if (!senderIdResult.success) {
      throw new Error(`Invalid senderId in database: ${prismaMessage.senderId}`);
    }

    const receiverIdResult = UserId.create(prismaMessage.receiverId);
    if (!receiverIdResult.success) {
      throw new Error(`Invalid receiverId in database: ${prismaMessage.receiverId}`);
    }

    let parentMessageId: MessageId | null = null;
    if (prismaMessage.parentMessageId) {
      const parentIdResult = MessageId.create(prismaMessage.parentMessageId);
      if (!parentIdResult.success) {
        throw new Error(`Invalid parentMessageId in database: ${prismaMessage.parentMessageId}`);
      }
      parentMessageId = parentIdResult.data;
    }

    return Message.reconstruct({
      id: messageIdResult.data,
      senderId: senderIdResult.data,
      receiverId: receiverIdResult.data,
      subject: prismaMessage.subject,
      body: prismaMessage.body,
      isRead: prismaMessage.isRead,
      parentMessageId,
      createdAt: prismaMessage.createdAt,
      readAt: prismaMessage.readAt,
    });
  }
}
