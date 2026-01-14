import { GetParticipantsUseCase } from "../GetParticipantsUseCase";
import { ParticipationRepository } from "@/domain/participation/repositories/ParticipationRepository";
import { ScheduleRepository } from "@/domain/schedule/repositories/ScheduleRepository";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Participation, ParticipationStatus } from "@/domain/participation/entities/Participation";
import { Schedule } from "@/domain/schedule/entities/Schedule";
import { ParticipationId } from "@/domain/participation/value-objects/ParticipationId";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";
import { UserId } from "@/domain/account/value-objects/UserId";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";

/**
 * GetParticipantsUseCase テスト
 * ホスト向け参加者管理機能のユースケーステスト
 */
describe("GetParticipantsUseCase", () => {
  let useCase: GetParticipantsUseCase;
  let participationRepository: jest.Mocked<ParticipationRepository>;
  let scheduleRepository: jest.Mocked<ScheduleRepository>;
  let projectRepository: jest.Mocked<ProjectRepository>;

  const mockHostId = UserId.generate();
  const mockGuestId1 = UserId.generate();
  const mockGuestId2 = UserId.generate();
  const mockScheduleId = ScheduleId.generate();
  const mockProjectId = ProjectId.generate();

  /**
   * テスト用のスケジュールを作成
   */
  const createMockSchedule = (): Schedule => {
    return Schedule.reconstruct({
      id: mockScheduleId,
      projectId: mockProjectId,
      title: "テスト体験",
      description: "テスト体験の説明",
      startDateTime: new Date(Date.now() + 86400000),
      duration: 120,
      capacity: 10,
      requirements: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  /**
   * テスト用の参加申込を作成
   */
  const createMockParticipation = (guestId: UserId, participantCount: number): Participation => {
    return Participation.reconstruct({
      id: ParticipationId.generate(),
      guestId,
      scheduleId: mockScheduleId,
      participantCount,
      status: ParticipationStatus.PENDING,
      appliedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
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

    useCase = new GetParticipantsUseCase(
      participationRepository,
      scheduleRepository,
      projectRepository
    );
  });

  describe("execute", () => {
    it("スケジュールの参加者一覧を取得できる", async () => {
      // Arrange
      const mockSchedule = createMockSchedule();
      const mockParticipations = [
        createMockParticipation(mockGuestId1, 2),
        createMockParticipation(mockGuestId2, 3),
      ];

      scheduleRepository.findById.mockResolvedValue(mockSchedule);
      participationRepository.findByScheduleId.mockResolvedValue(mockParticipations);
      projectRepository.findById.mockResolvedValue({
        id: mockProjectId,
        hostId: mockHostId,
      } as any);

      // Act
      const result = await useCase.execute({
        scheduleId: mockScheduleId.value,
        hostId: mockHostId.value,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.participants).toHaveLength(2);
        expect(result.data.schedule.capacity).toBe(10);
        expect(result.data.currentParticipantCount).toBe(5); // 2 + 3
      }
    });

    it("スケジュールが存在しない場合NOT_FOUNDエラー", async () => {
      // Arrange
      scheduleRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute({
        scheduleId: mockScheduleId.value,
        hostId: mockHostId.value,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("ホスト以外がアクセスした場合FORBIDDENエラー", async () => {
      // Arrange
      const otherHostId = UserId.generate();
      const mockSchedule = createMockSchedule();

      scheduleRepository.findById.mockResolvedValue(mockSchedule);
      projectRepository.findById.mockResolvedValue({
        id: mockProjectId,
        hostId: otherHostId, // 異なるホストID
      } as any);

      // Act
      const result = await useCase.execute({
        scheduleId: mockScheduleId.value,
        hostId: mockHostId.value,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });
  });
});
