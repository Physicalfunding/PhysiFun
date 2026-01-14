import { SendMessageUseCase } from "../SendMessageUseCase";
import { MessageRepository } from "@/domain/message/repositories/MessageRepository";
import { ParticipationRepository } from "@/domain/participation/repositories/ParticipationRepository";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Participation, ParticipationStatus } from "@/domain/participation/entities/Participation";
import { ParticipationId } from "@/domain/participation/value-objects/ParticipationId";
import { UserId } from "@/domain/account/value-objects/UserId";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";

/**
 * SendMessageUseCase テスト
 * メッセージ送信機能のユースケーステスト
 *
 * 送信権限ルール:
 * - ゲスト → ホスト: 参加申し込みをしているプロジェクトのホストにのみ送信可
 * - ホスト → ゲスト: 自分のプロジェクトに参加申し込みしているゲストにのみ送信可
 */
describe("SendMessageUseCase", () => {
  let useCase: SendMessageUseCase;
  let messageRepository: jest.Mocked<MessageRepository>;
  let participationRepository: jest.Mocked<ParticipationRepository>;
  let projectRepository: jest.Mocked<ProjectRepository>;

  const mockGuestId = UserId.generate();
  const mockHostId = UserId.generate();
  const mockScheduleId = ScheduleId.generate();
  const mockProjectId = ProjectId.generate();

  /**
   * テスト用のParticipationエンティティを作成
   */
  const createMockParticipation = (): Participation => {
    return Participation.reconstruct({
      id: ParticipationId.generate(),
      guestId: mockGuestId,
      scheduleId: mockScheduleId,
      participantCount: 2,
      status: ParticipationStatus.PENDING,
      appliedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    messageRepository = {
      findById: jest.fn(),
      findByReceiverId: jest.fn(),
      findBySenderId: jest.fn(),
      findThread: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      countUnread: jest.fn(),
    };

    participationRepository = {
      findById: jest.fn(),
      findByScheduleId: jest.fn(),
      findByUserId: jest.fn(),
      findByUserIdAndScheduleId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countByScheduleId: jest.fn(),
      sumParticipantCountByScheduleId: jest.fn(),
    };

    projectRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByHostId: jest.fn(),
      findPublished: jest.fn(),
      findAllPublished: jest.fn(),
      findFeatured: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countByHostId: jest.fn(),
    };

    useCase = new SendMessageUseCase(messageRepository, participationRepository, projectRepository);
  });

  describe("execute", () => {
    it("参加申し込み済みのゲストがホストにメッセージを送信できる", async () => {
      // Arrange
      const input = {
        senderId: mockGuestId.value,
        receiverId: mockHostId.value,
        subject: "テストメッセージ",
        body: "これはテストメッセージです。",
      };

      // ゲストの参加申し込みが存在する
      const mockParticipation = createMockParticipation();
      participationRepository.findByUserId.mockResolvedValue([mockParticipation]);

      // 参加申し込み先のプロジェクトのホストが受信者
      projectRepository.findById.mockResolvedValue({
        id: mockProjectId,
        hostId: mockHostId,
      } as unknown as ReturnType<typeof projectRepository.findById>);

      // 受信者（ホスト）のプロジェクトが存在する
      projectRepository.findByHostId.mockResolvedValue([
        {
          id: mockProjectId,
          hostId: mockHostId,
        } as unknown as Awaited<ReturnType<typeof projectRepository.findByHostId>>[number],
      ]);

      messageRepository.create.mockImplementation(async (m) => m);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subject).toBe("テストメッセージ");
      }
    });

    it("参加申し込みがないゲストはホストにメッセージを送信できない", async () => {
      // Arrange
      const input = {
        senderId: mockGuestId.value,
        receiverId: mockHostId.value,
        subject: "テストメッセージ",
        body: "これはテストメッセージです。",
      };

      // ゲストの参加申し込みがない
      participationRepository.findByUserId.mockResolvedValue([]);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("件名が空の場合VALIDATION_ERRORを返す", async () => {
      // Arrange
      const input = {
        senderId: mockGuestId.value,
        receiverId: mockHostId.value,
        subject: "",
        body: "これはテストメッセージです。",
      };

      const mockParticipation = createMockParticipation();
      participationRepository.findByUserId.mockResolvedValue([mockParticipation]);
      projectRepository.findById.mockResolvedValue({
        id: mockProjectId,
        hostId: mockHostId,
      } as unknown as ReturnType<typeof projectRepository.findById>);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("自分自身にはメッセージを送信できない", async () => {
      // Arrange
      const input = {
        senderId: mockGuestId.value,
        receiverId: mockGuestId.value, // 自分自身
        subject: "テストメッセージ",
        body: "これはテストメッセージです。",
      };

      const mockParticipation = createMockParticipation();
      participationRepository.findByUserId.mockResolvedValue([mockParticipation]);
      projectRepository.findById.mockResolvedValue({
        id: mockProjectId,
        hostId: mockGuestId,
      } as unknown as ReturnType<typeof projectRepository.findById>);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
