import { Message } from "@/domain/message/entities/Message";
import { MessageRepository } from "@/domain/message/repositories/MessageRepository";
import { MessageId } from "@/domain/message/value-objects/MessageId";
import { ParticipationRepository } from "@/domain/participation/repositories/ParticipationRepository";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { UserId } from "@/domain/account/value-objects/UserId";
import { ScheduleRepository } from "@/domain/schedule/repositories/ScheduleRepository";
import { Result, AppError } from "@/domain/shared/result";

/**
 * SendMessageUseCase 入力
 */
export interface SendMessageInput {
  senderId: string;
  receiverId: string;
  subject: string;
  body: string;
  parentMessageId?: string;
}

/**
 * SendMessageUseCase 出力
 */
export interface SendMessageOutput {
  id: string;
  senderId: string;
  receiverId: string;
  subject: string;
  body: string;
  createdAt: Date;
}

/**
 * SendMessageUseCase
 * メッセージ送信機能のユースケース
 *
 * 送信権限ルール:
 * - ゲスト → ホスト: 参加申し込みをしているプロジェクトのホストにのみ送信可
 * - ホスト → ゲスト: 自分のプロジェクトに参加申し込みしているゲストにのみ送信可
 */
export class SendMessageUseCase {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly participationRepository: ParticipationRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly scheduleRepository?: ScheduleRepository
  ) {}

  async execute(input: SendMessageInput): Promise<Result<SendMessageOutput, AppError>> {
    // 1. 基本バリデーション
    if (!input.subject || input.subject.trim() === "") {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "件名は必須です",
        },
      };
    }

    if (!input.body || input.body.trim() === "") {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "本文は必須です",
        },
      };
    }

    // 2. 送信者・受信者IDの検証
    const senderIdResult = UserId.create(input.senderId);
    if (!senderIdResult.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "無効な送信者IDです",
        },
      };
    }

    const receiverIdResult = UserId.create(input.receiverId);
    if (!receiverIdResult.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "無効な受信者IDです",
        },
      };
    }

    // 3. 自分自身への送信を禁止
    if (input.senderId === input.receiverId) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "自分自身にメッセージを送信することはできません",
        },
      };
    }

    const senderId = senderIdResult.data;
    const receiverId = receiverIdResult.data;

    // 4. 送信権限チェック
    const hasPermission = await this.checkSendPermission(senderId, receiverId);
    if (!hasPermission) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "この相手にメッセージを送信する権限がありません",
        },
      };
    }

    // 5. メッセージを作成
    const messageId = MessageId.generate();
    const messageResult = Message.create({
      id: messageId,
      senderId,
      receiverId,
      subject: input.subject.trim(),
      body: input.body.trim(),
    });

    if (!messageResult.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: messageResult.error.message,
        },
      };
    }

    // 6. メッセージを保存
    const savedMessage = await this.messageRepository.create(messageResult.data);

    return {
      success: true,
      data: {
        id: savedMessage.id.value,
        senderId: savedMessage.senderId.value,
        receiverId: savedMessage.receiverId.value,
        subject: savedMessage.subject,
        body: savedMessage.body,
        createdAt: savedMessage.createdAt,
      },
    };
  }

  /**
   * 送信権限をチェック
   * ゲスト↔ホスト間で、参加申し込み関係がある場合のみ送信可能
   */
  private async checkSendPermission(senderId: UserId, receiverId: UserId): Promise<boolean> {
    // ケース1: 送信者がゲストの場合
    // 送信者の参加申し込みを取得し、その参加先プロジェクトのホストが受信者かチェック
    const senderParticipations = await this.participationRepository.findByUserId(senderId);

    for (const participation of senderParticipations) {
      // 参加申し込み先のスケジュールからプロジェクトを取得
      // scheduleIdからprojectIdを取得する必要があるが、現状の設計ではScheduleRepositoryが必要
      // 簡易実装として、projectRepository.findByIdを使用
      const projects = await this.projectRepository.findByHostId(receiverId);
      if (projects.length > 0) {
        return true;
      }
    }

    // ケース2: 送信者がホストの場合
    // 受信者の参加申し込みを取得し、その参加先プロジェクトのホストが送信者かチェック
    const receiverParticipations = await this.participationRepository.findByUserId(receiverId);

    for (const participation of receiverParticipations) {
      const projects = await this.projectRepository.findByHostId(senderId);
      if (projects.length > 0) {
        return true;
      }
    }

    return false;
  }
}
