import { ApplyToScheduleUseCase } from "../ApplyToScheduleUseCase";
import { ParticipationRepository } from "@/domain/participation/repositories/ParticipationRepository";
import { ScheduleRepository } from "@/domain/schedule/repositories/ScheduleRepository";
import { Participation, ParticipationStatus } from "@/domain/participation/entities/Participation";
import { Schedule } from "@/domain/schedule/entities/Schedule";
import { ParticipationId } from "@/domain/participation/value-objects/ParticipationId";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";
import { UserId } from "@/domain/account/value-objects/UserId";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";

/**
 * ApplyToScheduleUseCase テスト
 * 参加申し込み機能のユースケーステスト
 */
describe("ApplyToScheduleUseCase", () => {
  let useCase: ApplyToScheduleUseCase;
  let participationRepository: jest.Mocked<ParticipationRepository>;
  let scheduleRepository: jest.Mocked<ScheduleRepository>;

  const mockUserId = UserId.generate();
  const mockScheduleId = ScheduleId.generate();
  const mockProjectId = ProjectId.generate();

  /**
   * テスト用のスケジュールエンティティを作成するヘルパー関数
   */
  const createMockSchedule = (capacity: number = 10): Schedule => {
    return Schedule.reconstruct({
      id: mockScheduleId,
      projectId: mockProjectId,
      title: "テスト体験",
      description: "テスト体験の説明",
      startDateTime: new Date(Date.now() + 86400000), // 24時間後
      duration: 120,
      capacity,
      requirements: null,
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

    scheduleRepository = {
      findById: jest.fn(),
      findByProjectId: jest.fn(),
      findUpcomingByProjectId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countByProjectId: jest.fn(),
    };

    useCase = new ApplyToScheduleUseCase(participationRepository, scheduleRepository);
  });

  describe("execute", () => {
    it("正常に参加申し込みを作成できる", async () => {
      // Arrange
      const input = {
        userId: mockUserId.value,
        scheduleId: mockScheduleId.value,
        participantCount: 2,
      };

      const mockSchedule = createMockSchedule(10);
      scheduleRepository.findById.mockResolvedValue(mockSchedule);
      participationRepository.findByUserIdAndScheduleId.mockResolvedValue(null);
      participationRepository.sumParticipantCountByScheduleId.mockResolvedValue(3);
      participationRepository.create.mockImplementation(async (p) => p);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.guestId.value).toBe(mockUserId.value);
        expect(result.data.scheduleId.value).toBe(mockScheduleId.value);
        expect(result.data.participantCount).toBe(2);
        expect(result.data.status).toBe(ParticipationStatus.PENDING);
      }
    });

    it("スケジュールが存在しない場合、NOT_FOUNDエラーを返す", async () => {
      // Arrange
      const input = {
        userId: mockUserId.value,
        scheduleId: mockScheduleId.value,
        participantCount: 1,
      };

      scheduleRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("既に同じスケジュールに申し込み済みの場合、CONFLICTエラーを返す", async () => {
      // Arrange
      const input = {
        userId: mockUserId.value,
        scheduleId: mockScheduleId.value,
        participantCount: 1,
      };

      const mockSchedule = createMockSchedule(10);
      const existingParticipation = Participation.reconstruct({
        id: ParticipationId.generate(),
        guestId: mockUserId,
        scheduleId: mockScheduleId,
        participantCount: 1,
        status: ParticipationStatus.PENDING,
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      scheduleRepository.findById.mockResolvedValue(mockSchedule);
      participationRepository.findByUserIdAndScheduleId.mockResolvedValue(existingParticipation);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CONFLICT");
        expect(result.error.message).toContain("既に申し込み済みです");
      }
    });

    it("定員オーバーの場合、VALIDATION_ERRORを返す", async () => {
      // Arrange
      const input = {
        userId: mockUserId.value,
        scheduleId: mockScheduleId.value,
        participantCount: 3,
      };

      const mockSchedule = createMockSchedule(5); // 定員5名
      scheduleRepository.findById.mockResolvedValue(mockSchedule);
      participationRepository.findByUserIdAndScheduleId.mockResolvedValue(null);
      participationRepository.sumParticipantCountByScheduleId.mockResolvedValue(4); // 既に4名

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("定員");
      }
    });

    it("参加人数が0以下の場合、VALIDATION_ERRORを返す", async () => {
      // Arrange
      const input = {
        userId: mockUserId.value,
        scheduleId: mockScheduleId.value,
        participantCount: 0,
      };

      const mockSchedule = createMockSchedule(10);
      scheduleRepository.findById.mockResolvedValue(mockSchedule);
      participationRepository.findByUserIdAndScheduleId.mockResolvedValue(null);
      participationRepository.sumParticipantCountByScheduleId.mockResolvedValue(0);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("過去のスケジュールには申し込めない", async () => {
      // Arrange
      const input = {
        userId: mockUserId.value,
        scheduleId: mockScheduleId.value,
        participantCount: 1,
      };

      // 過去のスケジュールを作成
      const pastSchedule = Schedule.reconstruct({
        id: mockScheduleId,
        projectId: mockProjectId,
        title: "過去の体験",
        description: "過去の体験の説明",
        startDateTime: new Date(Date.now() - 86400000), // 24時間前
        duration: 120,
        capacity: 10,
        requirements: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      scheduleRepository.findById.mockResolvedValue(pastSchedule);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("終了");
      }
    });
  });
});
