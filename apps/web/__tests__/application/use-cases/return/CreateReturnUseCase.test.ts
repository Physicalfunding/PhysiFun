/**
 * CreateReturnUseCase テスト
 * リターン作成機能のユニットテスト
 */
import { CreateReturnUseCase } from "@/application/use-cases/return/CreateReturnUseCase";
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

const mockReturnRepository = {
  findById: jest.fn(),
  findByProjectId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  countByProjectId: jest.fn(),
  updateOrder: jest.fn(),
};

describe("CreateReturnUseCase", () => {
  let useCase: CreateReturnUseCase;
  let mockProject: Project;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateReturnUseCase(mockProjectRepository, mockReturnRepository);

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
    it("リターンを作成できる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockReturnRepository.countByProjectId.mockResolvedValue(0);
      mockReturnRepository.create.mockImplementation((r) => Promise.resolve(r));

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        name: "体験記念品",
        description: "参加者への記念品をお送りします",
        estimatedDeliveryDate: new Date("2025-06-01"),
        quantityLimit: 10,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("体験記念品");
        expect(result.data.quantityLimit).toBe(10);
      }
      expect(mockReturnRepository.create).toHaveBeenCalledTimes(1);
    });

    it("数量制限なしでリターンを作成できる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockReturnRepository.countByProjectId.mockResolvedValue(0);
      mockReturnRepository.create.mockImplementation((r) => Promise.resolve(r));

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        name: "感謝のお手紙",
        description: "心を込めたお手紙をお送りします",
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quantityLimit).toBeNull();
        expect(result.data.estimatedDeliveryDate).toBeNull();
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
        hostId: mockProject.hostId.value,
        name: "リターン名",
        description: "リターンの説明",
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

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: "different-host-id",
        name: "リターン名",
        description: "リターンの説明",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("リターン名が空の場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockReturnRepository.countByProjectId.mockResolvedValue(0);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        name: "",
        description: "リターンの説明",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
