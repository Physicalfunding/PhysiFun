/**
 * ReorderReturnsUseCase テスト
 * リターン順序変更機能のユニットテスト
 */
import { ReorderReturnsUseCase } from "@/application/use-cases/return/ReorderReturnsUseCase";
import { Project, ProjectStatus, Category } from "@/domain/project/entities/Project";
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

describe("ReorderReturnsUseCase", () => {
  let useCase: ReorderReturnsUseCase;
  let mockProject: Project;
  const returnIds = [ReturnId.generate(), ReturnId.generate(), ReturnId.generate()];

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ReorderReturnsUseCase(mockProjectRepository, mockReturnRepository);

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
    it("リターンの順序を変更できる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockReturnRepository.updateOrder.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        orderedReturnIds: returnIds.map((id) => id.value),
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockReturnRepository.updateOrder).toHaveBeenCalledTimes(1);
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
        orderedReturnIds: returnIds.map((id) => id.value),
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
        orderedReturnIds: returnIds.map((id) => id.value),
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("無効なリターンIDが含まれる場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        orderedReturnIds: ["invalid-uuid", returnIds[0].value],
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
