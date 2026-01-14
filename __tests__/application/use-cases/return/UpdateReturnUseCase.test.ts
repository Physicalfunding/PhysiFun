/**
 * UpdateReturnUseCase テスト
 * リターン更新機能のユニットテスト
 */
import { UpdateReturnUseCase } from "@/application/use-cases/return/UpdateReturnUseCase";
import { Project, ProjectStatus, Category } from "@/domain/project/entities/Project";
import { Return } from "@/domain/project/entities/Return";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";
import { ReturnId } from "@/domain/project/value-objects/ReturnId";

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

describe("UpdateReturnUseCase", () => {
  let useCase: UpdateReturnUseCase;
  let mockProject: Project;
  let mockReturn: Return;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UpdateReturnUseCase(mockProjectRepository, mockReturnRepository);

    const projectId = ProjectId.generate();
    const hostId = UserId.generate();
    const returnId = ReturnId.generate();

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

    mockReturn = Return.reconstruct({
      id: returnId,
      projectId: projectId,
      name: "既存リターン",
      description: "既存のリターン説明",
      estimatedDeliveryDate: new Date("2025-06-01"),
      quantityLimit: 10,
      order: 0,
      createdAt: new Date(),
    });
  });

  describe("正常系", () => {
    it("リターンを更新できる", async () => {
      // Arrange
      mockReturnRepository.findById.mockResolvedValue(mockReturn);
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockReturnRepository.update.mockImplementation((r) => Promise.resolve(r));

      // Act
      const result = await useCase.execute({
        returnId: mockReturn.id.value,
        hostId: mockProject.hostId.value,
        name: "更新されたリターン",
        description: "更新された説明",
        estimatedDeliveryDate: new Date("2025-07-01"),
        quantityLimit: 20,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("更新されたリターン");
        expect(result.data.description).toBe("更新された説明");
        expect(result.data.quantityLimit).toBe(20);
      }
      expect(mockReturnRepository.update).toHaveBeenCalledTimes(1);
    });

    it("一部のフィールドのみ更新できる", async () => {
      // Arrange
      mockReturnRepository.findById.mockResolvedValue(mockReturn);
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockReturnRepository.update.mockImplementation((r) => Promise.resolve(r));

      // Act
      const result = await useCase.execute({
        returnId: mockReturn.id.value,
        hostId: mockProject.hostId.value,
        name: "名前のみ更新",
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("名前のみ更新");
        expect(result.data.description).toBe("既存のリターン説明"); // 変更なし
      }
    });

    it("数量制限を解除できる", async () => {
      // Arrange
      mockReturnRepository.findById.mockResolvedValue(mockReturn);
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockReturnRepository.update.mockImplementation((r) => Promise.resolve(r));

      // Act
      const result = await useCase.execute({
        returnId: mockReturn.id.value,
        hostId: mockProject.hostId.value,
        quantityLimit: null,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quantityLimit).toBeNull();
      }
    });
  });

  describe("異常系", () => {
    it("リターンが存在しない場合エラーを返す", async () => {
      // Arrange
      mockReturnRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute({
        returnId: ReturnId.generate().value,
        hostId: mockProject.hostId.value,
        name: "更新",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("プロジェクトのオーナーでない場合エラーを返す", async () => {
      // Arrange
      mockReturnRepository.findById.mockResolvedValue(mockReturn);
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        returnId: mockReturn.id.value,
        hostId: "different-host-id",
        name: "更新",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("リターン名が空の場合エラーを返す", async () => {
      // Arrange
      mockReturnRepository.findById.mockResolvedValue(mockReturn);
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        returnId: mockReturn.id.value,
        hostId: mockProject.hostId.value,
        name: "",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
