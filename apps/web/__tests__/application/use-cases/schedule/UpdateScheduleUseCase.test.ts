/**
 * UpdateScheduleUseCase テスト
 * 体験スケジュール更新機能のユニットテスト
 */
import { UpdateScheduleUseCase } from "@/application/use-cases/schedule/UpdateScheduleUseCase";
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

describe("UpdateScheduleUseCase", () => {
  let useCase: UpdateScheduleUseCase;
  let mockProject: Project;
  let mockSchedule: Schedule;
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UpdateScheduleUseCase(mockProjectRepository, mockScheduleRepository);

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
      title: "元のタイトル",
      description: "元の説明",
      startDateTime: futureDate,
      duration: 120,
      capacity: 10,
      requirements: "元の持ち物",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe("正常系", () => {
    it("スケジュールを更新できる", async () => {
      // Arrange
      const newFutureDate = new Date();
      newFutureDate.setDate(newFutureDate.getDate() + 14); // 2週間後

      mockScheduleRepository.findById.mockResolvedValue(mockSchedule);
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockScheduleRepository.update.mockImplementation((schedule) => Promise.resolve(schedule));

      // Act
      const result = await useCase.execute({
        scheduleId: mockSchedule.id.value,
        hostId: mockProject.hostId.value,
        title: "更新されたタイトル",
        description: "更新された説明",
        startDateTime: newFutureDate,
        duration: 180,
        capacity: 15,
        requirements: "更新された持ち物",
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("更新されたタイトル");
        expect(result.data.capacity).toBe(15);
        expect(result.data.duration).toBe(180);
      }
      expect(mockScheduleRepository.update).toHaveBeenCalledTimes(1);
    });

    it("一部のフィールドのみ更新できる", async () => {
      // Arrange
      mockScheduleRepository.findById.mockResolvedValue(mockSchedule);
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockScheduleRepository.update.mockImplementation((schedule) => Promise.resolve(schedule));

      // Act
      const result = await useCase.execute({
        scheduleId: mockSchedule.id.value,
        hostId: mockProject.hostId.value,
        title: "タイトルのみ更新",
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("タイトルのみ更新");
        expect(result.data.description).toBe("元の説明");
        expect(result.data.capacity).toBe(10);
      }
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
        title: "更新タイトル",
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
        title: "更新タイトル",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("開催日時を過去に変更しようとした場合エラーを返す", async () => {
      // Arrange
      mockScheduleRepository.findById.mockResolvedValue(mockSchedule);
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      // Act
      const result = await useCase.execute({
        scheduleId: mockSchedule.id.value,
        hostId: mockProject.hostId.value,
        startDateTime: pastDate,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
