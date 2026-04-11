/**
 * GetProjectDetailUseCase テスト
 * プロジェクト詳細取得機能のユニットテスト
 */
import { GetProjectDetailUseCase } from "@/application/use-cases/guest/GetProjectDetailUseCase";
import { Project, ProjectStatus, Category } from "@/domain/project/entities/Project";
import { Return } from "@/domain/project/entities/Return";
import { Schedule } from "@/domain/schedule/entities/Schedule";
import { User, UserType } from "@/domain/account/entities/User";
import { HashedPassword } from "@/domain/account/value-objects/Password";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";
import { ReturnId } from "@/domain/project/value-objects/ReturnId";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";
import { Email } from "@/domain/account/value-objects/Email";

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

const mockReturnRepository = {
  findById: jest.fn(),
  findByProjectId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  countByProjectId: jest.fn(),
  updateOrder: jest.fn(),
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

const mockUserRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  existsByEmail: jest.fn(),
};

describe("GetProjectDetailUseCase", () => {
  let useCase: GetProjectDetailUseCase;
  let mockProject: Project;
  let mockHost: User;
  let mockReturns: Return[];
  let mockSchedules: Schedule[];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetProjectDetailUseCase(
      mockProjectRepository,
      mockReturnRepository,
      mockScheduleRepository,
      mockUserRepository
    );

    const projectId = ProjectId.generate();
    const hostId = UserId.generate();
    const emailResult = Email.create("host@example.com");
    const passwordHash = HashedPassword.fromHash("$2b$10$hashedpassword");

    mockHost = User.reconstruct({
      id: hostId,
      email: emailResult.success ? emailResult.data : undefined!,
      passwordHash: passwordHash,
      name: "テストホスト",
      userType: UserType.HOST,
      avatarUrl: "https://example.com/avatar.jpg",
      bio: "ホストの自己紹介",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockProject = Project.reconstruct({
      id: projectId,
      hostId: hostId,
      title: "古民家再生体験",
      summary: "日本の伝統建築を学べる体験",
      description: "テストの詳細説明です。50文字以上の説明文が必要なので長めに書いています。",
      category: Category.KOMINKA,
      location: "京都府",
      imageUrls: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
      status: ProjectStatus.PUBLISHED,
      slug: "kominka-saisei",
      isFeatured: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
    });

    mockReturns = [
      Return.reconstruct({
        id: ReturnId.generate(),
        projectId: projectId,
        name: "リターン1",
        description: "リターン1の説明",
        estimatedDeliveryDate: new Date("2025-06-01"),
        quantityLimit: 10,
        order: 0,
        createdAt: new Date(),
      }),
    ];

    mockSchedules = [
      Schedule.reconstruct({
        id: ScheduleId.generate(),
        projectId: projectId,
        title: "体験スケジュール1",
        description: "スケジュールの説明",
        startDateTime: futureDate,
        duration: 120,
        capacity: 10,
        requirements: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ];
  });

  describe("正常系", () => {
    it("スラッグでプロジェクト詳細を取得できる", async () => {
      // Arrange
      mockProjectRepository.findBySlug.mockResolvedValue(mockProject);
      mockUserRepository.findById.mockResolvedValue(mockHost);
      mockReturnRepository.findByProjectId.mockResolvedValue(mockReturns);
      mockScheduleRepository.findUpcomingByProjectId.mockResolvedValue(mockSchedules);

      // Act
      const result = await useCase.execute({ slug: "kominka-saisei" });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("古民家再生体験");
        expect(result.data.host.name).toBe("テストホスト");
        expect(result.data.returns).toHaveLength(1);
        expect(result.data.schedules).toHaveLength(1);
      }
    });

    it("IDでプロジェクト詳細を取得できる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockUserRepository.findById.mockResolvedValue(mockHost);
      mockReturnRepository.findByProjectId.mockResolvedValue(mockReturns);
      mockScheduleRepository.findUpcomingByProjectId.mockResolvedValue(mockSchedules);

      // Act
      const result = await useCase.execute({ projectId: mockProject.id.value });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("古民家再生体験");
      }
    });

    it("画像一覧を含む詳細を取得できる", async () => {
      // Arrange
      mockProjectRepository.findBySlug.mockResolvedValue(mockProject);
      mockUserRepository.findById.mockResolvedValue(mockHost);
      mockReturnRepository.findByProjectId.mockResolvedValue([]);
      mockScheduleRepository.findUpcomingByProjectId.mockResolvedValue([]);

      // Act
      const result = await useCase.execute({ slug: "kominka-saisei" });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toHaveLength(2);
      }
    });
  });

  describe("異常系", () => {
    it("プロジェクトが見つからない場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findBySlug.mockResolvedValue(null);

      // Act
      const result = await useCase.execute({ slug: "non-existent" });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("非公開プロジェクトの場合エラーを返す", async () => {
      // Arrange
      const draftProject = Project.reconstruct({
        id: mockProject.id,
        hostId: mockProject.hostId,
        title: mockProject.title,
        summary: mockProject.summary,
        description: mockProject.description,
        category: mockProject.category,
        location: mockProject.location,
        imageUrls: mockProject.imageUrls,
        status: ProjectStatus.DRAFT,
        slug: mockProject.slug,
        isFeatured: mockProject.isFeatured,
        createdAt: mockProject.createdAt,
        updatedAt: mockProject.updatedAt,
        publishedAt: mockProject.publishedAt,
      });
      mockProjectRepository.findBySlug.mockResolvedValue(draftProject);

      // Act
      const result = await useCase.execute({ slug: "kominka-saisei" });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("スラッグとIDの両方が指定されていない場合エラーを返す", async () => {
      // Act
      const result = await useCase.execute({});

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
