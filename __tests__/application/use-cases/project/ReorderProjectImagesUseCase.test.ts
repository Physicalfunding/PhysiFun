/**
 * ReorderProjectImagesUseCase テスト
 * プロジェクト画像並び替え機能のユニットテスト
 */
import { ReorderProjectImagesUseCase } from "@/application/use-cases/project/ReorderProjectImagesUseCase";
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

describe("ReorderProjectImagesUseCase", () => {
  let useCase: ReorderProjectImagesUseCase;
  let mockProject: Project;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ReorderProjectImagesUseCase(mockProjectRepository);

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
      imageUrls: [
        "https://storage.example.com/projects/test/1.jpg",
        "https://storage.example.com/projects/test/2.jpg",
        "https://storage.example.com/projects/test/3.jpg",
      ],
      status: ProjectStatus.DRAFT,
      slug: null,
      isFeatured: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: null,
    });
  });

  describe("正常系", () => {
    it("画像の順序を変更できる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockProjectRepository.update.mockImplementation((project: Project) => Promise.resolve(project));

      const newOrder = [2, 0, 1]; // 3, 1, 2 の順に変更

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        newOrder,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toHaveLength(3);
        expect(result.data.imageUrls[0]).toBe("https://storage.example.com/projects/test/3.jpg");
        expect(result.data.imageUrls[1]).toBe("https://storage.example.com/projects/test/1.jpg");
        expect(result.data.imageUrls[2]).toBe("https://storage.example.com/projects/test/2.jpg");
      }
      expect(mockProjectRepository.update).toHaveBeenCalledTimes(1);
    });

    it("最初と最後の画像を入れ替えられる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockProjectRepository.update.mockImplementation((project: Project) => Promise.resolve(project));

      const newOrder = [2, 1, 0]; // 逆順に

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        newOrder,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls[0]).toBe("https://storage.example.com/projects/test/3.jpg");
        expect(result.data.imageUrls[1]).toBe("https://storage.example.com/projects/test/2.jpg");
        expect(result.data.imageUrls[2]).toBe("https://storage.example.com/projects/test/1.jpg");
      }
    });
  });

  describe("異常系", () => {
    it("プロジェクトが存在しない場合エラーを返す", async () => {
      // Arrange
      const nonExistentProjectId = ProjectId.generate();
      mockProjectRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute({
        projectId: nonExistentProjectId.value,
        hostId: mockProject.hostId.value,
        newOrder: [0, 1, 2],
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
        newOrder: [0, 1, 2],
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("順序配列の長さが一致しない場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        newOrder: [0, 1], // 2要素しかない
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("順序配列に重複がある場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        newOrder: [0, 0, 1], // 重複
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("順序配列に無効なインデックスがある場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        newOrder: [0, 1, 5], // 5は範囲外
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
