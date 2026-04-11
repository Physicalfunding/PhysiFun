/**
 * DeleteScheduleUseCase テスト
 * 体験スケジュール削除機能のユニットテスト
 */
import { DeleteScheduleUseCase } from "@/application/use-cases/schedule/DeleteScheduleUseCase";
import { Project, ProjectStatus, Category } from "@/domain/project/entities/Project";
import { Schedule } from "@/domain/schedule/entities/Schedule";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";

const mockProjectRepository = {
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

const mockScheduleRepository = {
  findById: jest.fn(),
  findByProjectId: jest.fn(),
  findUpcomingByProjectId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  countByProjectId: jest.fn(),
};

const mockParticipationRepository = {
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

describe("DeleteScheduleUseCase", () => {
  let useCase: DeleteScheduleUseCase;
  let mockProject: Project;
  let mockSchedule: Schedule;
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new DeleteScheduleUseCase(
      mockProjectRepository,
      mockScheduleRepository,
      mockParticipationRepository
    );

    // テスト用プロジェクトの作成
    const projectId = ProjectId.generate();
    const hostId = UserId.generate();

    mockProject = Project.reconstruct({
      id: projectId,
      hostId: hostId,
      title: "テストプロジェクト",
      summary: "テストの概要",
      description: "テストの詳細説明です。50文字以上の説明文が必要なので長めに書いています。",
      category: Category.KOMINKA,
      location: "東京都",
      imageUrls: [],
      status: ProjectStatus.DRAFT,
      slug: null,
      isFeatured: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: null,
    });

    // テスト用スケジュールの作成
    const scheduleId = ScheduleId.generate();
    mockSchedule = Schedule.reconstruct({
      id: scheduleId,
      projectId: projectId,
      title: "テストスケジュール",
      description: "テスト説明",
      startDateTime: futureDate,
      duration: 120,
      capacity: 10,
      requirements: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe("正常系", () => {
    it("参加申込がないスケジュールを削除できる", async () => {
      // Arrange
      mockScheduleRepository.findById.mockResolvedValue(mockSchedule);
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockParticipationRepository.countByScheduleId.mockResolvedValue(0);
      mockScheduleRepository.delete.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute({
        scheduleId: mockSchedule.id.value,
        hostId: mockProject.hostId.value,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockScheduleRepository.delete).toHaveBeenCalledTimes(1);
    });

    it("参加申込があってもforceフラグで削除できる", async () => {
      // Arrange
      mockScheduleRepository.findById.mockResolvedValue(mockSchedule);
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockParticipationRepository.countByScheduleId.mockResolvedValue(5);
      mockScheduleRepository.delete.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute({
        scheduleId: mockSchedule.id.value,
        hostId: mockProject.hostId.value,
        force: true,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockScheduleRepository.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("異常系", () => {
    it("スケジュールが存在しない場合エラーを返す", async () => {
      // Arrange
      mockScheduleRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute({
        scheduleId: ScheduleId.generate().value,
        hostId: mockProject.hostId.value,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("プロジェクトのオーナーでない場合エラーを返す", async () => {
      // Arrange
      mockScheduleRepository.findById.mockResolvedValue(mockSchedule);
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        scheduleId: mockSchedule.id.value,
        hostId: "different-host-id",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("参加申込があり、forceフラグがない場合はwarningを返す", async () => {
      // Arrange
      mockScheduleRepository.findById.mockResolvedValue(mockSchedule);
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockParticipationRepository.countByScheduleId.mockResolvedValue(3);

      // Act
      const result = await useCase.execute({
        scheduleId: mockSchedule.id.value,
        hostId: mockProject.hostId.value,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CONFLICT");
        expect(result.error.message).toContain("参加申込");
      }
      expect(mockScheduleRepository.delete).not.toHaveBeenCalled();
    });
  });
});
