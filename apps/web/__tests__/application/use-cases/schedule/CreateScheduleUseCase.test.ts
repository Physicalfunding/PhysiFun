/**
 * CreateScheduleUseCase テスト
 * 体験スケジュール作成機能のユニットテスト
 */
import { CreateScheduleUseCase } from "@/application/use-cases/schedule/CreateScheduleUseCase";
import { Project, ProjectStatus, Category } from "@/domain/project/entities/Project";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

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

describe("CreateScheduleUseCase", () => {
  let useCase: CreateScheduleUseCase;
  let mockProject: Project;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateScheduleUseCase(mockProjectRepository, mockScheduleRepository);

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
  });

  describe("正常系", () => {
    it("体験スケジュールを作成できる", async () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 1週間後

      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockScheduleRepository.create.mockImplementation((schedule) => Promise.resolve(schedule));

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        title: "古民家再生体験",
        description: "実際に古民家の修復作業を体験していただきます。",
        startDateTime: futureDate,
        duration: 180, // 3時間
        capacity: 10,
        requirements: "動きやすい服装でお越しください",
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("古民家再生体験");
        expect(result.data.capacity).toBe(10);
        expect(result.data.duration).toBe(180);
      }
      expect(mockScheduleRepository.create).toHaveBeenCalledTimes(1);
    });

    it("所要時間・持ち物なしで作成できる", async () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockScheduleRepository.create.mockImplementation((schedule) => Promise.resolve(schedule));

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        title: "古民家再生体験",
        description: "実際に古民家の修復作業を体験していただきます。",
        startDateTime: futureDate,
        capacity: 5,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.duration).toBeNull();
        expect(result.data.requirements).toBeNull();
      }
    });
  });

  describe("異常系", () => {
    it("プロジェクトが存在しない場合エラーを返す", async () => {
      // Arrange
      const nonExistentProjectId = ProjectId.generate();
      mockProjectRepository.findById.mockResolvedValue(null);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      // Act
      const result = await useCase.execute({
        projectId: nonExistentProjectId.value,
        hostId: mockProject.hostId.value,
        title: "体験タイトル",
        description: "体験内容の説明",
        startDateTime: futureDate,
        capacity: 10,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("プロジェクトのオーナーでない場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: "different-host-id",
        title: "体験タイトル",
        description: "体験内容の説明",
        startDateTime: futureDate,
        capacity: 10,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("タイトルが空の場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        title: "",
        description: "体験内容の説明",
        startDateTime: futureDate,
        capacity: 10,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("開催日時が過去の場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // 1日前

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        title: "体験タイトル",
        description: "体験内容の説明",
        startDateTime: pastDate,
        capacity: 10,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("募集人数が0以下の場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        title: "体験タイトル",
        description: "体験内容の説明",
        startDateTime: futureDate,
        capacity: 0,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
