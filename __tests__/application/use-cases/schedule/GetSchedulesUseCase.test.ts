/**
 * GetSchedulesUseCase テスト
 * 体験スケジュール一覧取得機能のユニットテスト
 */
import { GetSchedulesUseCase } from "@/application/use-cases/schedule/GetSchedulesUseCase";
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

describe("GetSchedulesUseCase", () => {
  let useCase: GetSchedulesUseCase;
  let mockProject: Project;
  let mockSchedules: Schedule[];

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetSchedulesUseCase(mockProjectRepository, mockScheduleRepository);

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
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 7);
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 14);

    mockSchedules = [
      Schedule.reconstruct({
        id: ScheduleId.generate(),
        projectId: projectId,
        title: "スケジュール1",
        description: "説明1",
        startDateTime: futureDate1,
        duration: 120,
        capacity: 10,
        requirements: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      Schedule.reconstruct({
        id: ScheduleId.generate(),
        projectId: projectId,
        title: "スケジュール2",
        description: "説明2",
        startDateTime: futureDate2,
        duration: 180,
        capacity: 5,
        requirements: "持ち物あり",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ];
  });

  describe("正常系", () => {
    it("プロジェクトのスケジュール一覧を取得できる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockScheduleRepository.findByProjectId.mockResolvedValue(mockSchedules);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schedules).toHaveLength(2);
        expect(result.data.schedules[0].title).toBe("スケジュール1");
        expect(result.data.schedules[1].title).toBe("スケジュール2");
      }
    });

    it("今後のスケジュールのみ取得できる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockScheduleRepository.findUpcomingByProjectId.mockResolvedValue([mockSchedules[0]]);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        upcomingOnly: true,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schedules).toHaveLength(1);
      }
      expect(mockScheduleRepository.findUpcomingByProjectId).toHaveBeenCalledTimes(1);
    });

    it("スケジュールがない場合は空配列を返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockScheduleRepository.findByProjectId.mockResolvedValue([]);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schedules).toHaveLength(0);
      }
    });
  });

  describe("異常系", () => {
    it("プロジェクトが存在しない場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute({
        projectId: ProjectId.generate().value,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });
});
