import { GetMyParticipationsUseCase } from "../GetMyParticipationsUseCase";
import { ParticipationRepository } from "@/domain/participation/repositories/ParticipationRepository";
import { Participation, ParticipationStatus } from "@/domain/participation/entities/Participation";
import { ParticipationId } from "@/domain/participation/value-objects/ParticipationId";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * GetMyParticipationsUseCase テスト
 * ゲストマイページ用の参加予定一覧取得ユースケース
 */
describe("GetMyParticipationsUseCase", () => {
  let useCase: GetMyParticipationsUseCase;
  let participationRepository: jest.Mocked<ParticipationRepository>;

  const mockUserId = UserId.generate();

  /**
   * テスト用のParticipationエンティティを作成するヘルパー関数
   */
  const createMockParticipation = (
    scheduleId: ScheduleId,
    appliedAt: Date,
    status: ParticipationStatus = ParticipationStatus.PENDING
  ): Participation => {
    return Participation.reconstruct({
      id: ParticipationId.generate(),
      guestId: mockUserId,
      scheduleId,
      participantCount: 2,
      status,
      appliedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    // モックリポジトリを作成
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

    useCase = new GetMyParticipationsUseCase(participationRepository);
  });

  describe("execute", () => {
    it("ユーザーの参加予定一覧を取得できる", async () => {
      // Arrange
      const scheduleId1 = ScheduleId.generate();
      const scheduleId2 = ScheduleId.generate();

      const mockParticipations = [
        createMockParticipation(scheduleId1, new Date("2024-01-10")),
        createMockParticipation(scheduleId2, new Date("2024-01-15")),
      ];

      participationRepository.findByUserId.mockResolvedValue(mockParticipations);

      // Act
      const result = await useCase.execute({ userId: mockUserId.value });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
      expect(participationRepository.findByUserId).toHaveBeenCalledWith(mockUserId);
    });

    it("参加予定がない場合は空の配列を返す", async () => {
      // Arrange
      participationRepository.findByUserId.mockResolvedValue([]);

      // Act
      const result = await useCase.execute({ userId: mockUserId.value });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it("無効なユーザーIDの場合はVALIDATION_ERRORを返す", async () => {
      // Act
      const result = await useCase.execute({ userId: "invalid-id" });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("キャンセル済みの参加は除外して返す（オプション指定時）", async () => {
      // Arrange
      const scheduleId1 = ScheduleId.generate();
      const scheduleId2 = ScheduleId.generate();

      const mockParticipations = [
        createMockParticipation(scheduleId1, new Date("2024-01-10"), ParticipationStatus.PENDING),
        createMockParticipation(scheduleId2, new Date("2024-01-15"), ParticipationStatus.CANCELLED),
      ];

      participationRepository.findByUserId.mockResolvedValue(mockParticipations);

      // Act
      const result = await useCase.execute({ userId: mockUserId.value, excludeCancelled: true });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].status).toBe(ParticipationStatus.PENDING);
      }
    });
  });
});
