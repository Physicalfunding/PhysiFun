/**
 * DeleteProjectImageUseCase テスト
 * プロジェクト画像削除機能のユニットテスト
 */
import { DeleteProjectImageUseCase } from "@/application/use-cases/project/DeleteProjectImageUseCase";
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

const mockImageUploadService = {
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
  getPublicUrl: jest.fn(),
};

describe("DeleteProjectImageUseCase", () => {
  let useCase: DeleteProjectImageUseCase;
  let mockProject: Project;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new DeleteProjectImageUseCase(mockProjectRepository, mockImageUploadService);

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
    it("指定したインデックスの画像を削除できる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockProjectRepository.update.mockImplementation((project: Project) =>
        Promise.resolve(project)
      );

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        imageIndex: 1,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toHaveLength(2);
        expect(result.data.imageUrls).not.toContain(
          "https://storage.example.com/projects/test/2.jpg"
        );
        expect(result.data.imageUrls[0]).toBe("https://storage.example.com/projects/test/1.jpg");
        expect(result.data.imageUrls[1]).toBe("https://storage.example.com/projects/test/3.jpg");
      }
      expect(mockProjectRepository.update).toHaveBeenCalledTimes(1);
    });

    it("最初の画像を削除できる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockProjectRepository.update.mockImplementation((project: Project) =>
        Promise.resolve(project)
      );

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        imageIndex: 0,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toHaveLength(2);
        expect(result.data.imageUrls[0]).toBe("https://storage.example.com/projects/test/2.jpg");
      }
    });

    it("最後の画像を削除できる", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockProjectRepository.update.mockImplementation((project: Project) =>
        Promise.resolve(project)
      );

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        imageIndex: 2,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toHaveLength(2);
        expect(result.data.imageUrls).not.toContain(
          "https://storage.example.com/projects/test/3.jpg"
        );
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
        imageIndex: 0,
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
        imageIndex: 0,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("インデックスが範囲外の場合エラーを返す（負の数）", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        imageIndex: -1,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("インデックスが範囲外の場合エラーを返す（配列サイズ以上）", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        imageIndex: 10,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("画像がない場合エラーを返す", async () => {
      // Arrange
      const emptyProject = mockProject.updateImages([]);
      mockProjectRepository.findById.mockResolvedValue(emptyProject);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        imageIndex: 0,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
