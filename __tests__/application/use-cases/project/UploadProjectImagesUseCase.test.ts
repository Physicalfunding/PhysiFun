/**
 * UploadProjectImagesUseCase テスト
 * プロジェクト画像アップロード機能のユニットテスト
 */
import { UploadProjectImagesUseCase } from "@/application/use-cases/project/UploadProjectImagesUseCase";
import { Project, ProjectStatus, Category } from "@/domain/project/entities/Project";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

// モックの型定義
type MockProject = Project | null;

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

describe("UploadProjectImagesUseCase", () => {
  let useCase: UploadProjectImagesUseCase;
  let mockProject: Project;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UploadProjectImagesUseCase(mockProjectRepository, mockImageUploadService);

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
    it("単一画像のアップロードに成功する", async () => {
      // Arrange
      const file = {
        name: "test.jpg",
        type: "image/jpeg",
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from("test image content"),
      };

      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockImageUploadService.uploadImage.mockResolvedValue({
        path: "projects/test-project/12345.jpg",
        publicUrl: "https://storage.example.com/projects/test-project/12345.jpg",
      });
      mockProjectRepository.update.mockImplementation((project: Project) => Promise.resolve(project));

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        files: [file],
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toHaveLength(1);
        expect(result.data.imageUrls[0]).toBe(
          "https://storage.example.com/projects/test-project/12345.jpg"
        );
      }
      expect(mockImageUploadService.uploadImage).toHaveBeenCalledTimes(1);
      expect(mockProjectRepository.update).toHaveBeenCalledTimes(1);
    });

    it("複数画像のアップロードに成功する", async () => {
      // Arrange
      const files = [
        {
          name: "test1.jpg",
          type: "image/jpeg",
          size: 1024 * 1024,
          buffer: Buffer.from("test image 1"),
        },
        {
          name: "test2.png",
          type: "image/png",
          size: 2 * 1024 * 1024,
          buffer: Buffer.from("test image 2"),
        },
        {
          name: "test3.webp",
          type: "image/webp",
          size: 500 * 1024,
          buffer: Buffer.from("test image 3"),
        },
      ];

      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockImageUploadService.uploadImage
        .mockResolvedValueOnce({
          path: "projects/test/1.jpg",
          publicUrl: "https://storage.example.com/projects/test/1.jpg",
        })
        .mockResolvedValueOnce({
          path: "projects/test/2.png",
          publicUrl: "https://storage.example.com/projects/test/2.png",
        })
        .mockResolvedValueOnce({
          path: "projects/test/3.webp",
          publicUrl: "https://storage.example.com/projects/test/3.webp",
        });
      mockProjectRepository.update.mockImplementation((project: Project) => Promise.resolve(project));

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        files,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toHaveLength(3);
      }
      expect(mockImageUploadService.uploadImage).toHaveBeenCalledTimes(3);
    });

    it("既存の画像に追加でアップロードできる", async () => {
      // Arrange
      const existingProject = mockProject.updateImages(["https://existing.example.com/image1.jpg"]);

      const file = {
        name: "new.jpg",
        type: "image/jpeg",
        size: 1024 * 1024,
        buffer: Buffer.from("new image"),
      };

      mockProjectRepository.findById.mockResolvedValue(existingProject);
      mockImageUploadService.uploadImage.mockResolvedValue({
        path: "projects/test/new.jpg",
        publicUrl: "https://storage.example.com/projects/test/new.jpg",
      });
      mockProjectRepository.update.mockImplementation((project: Project) => Promise.resolve(project));

      // Act
      const result = await useCase.execute({
        projectId: existingProject.id.value,
        hostId: existingProject.hostId.value,
        files: [file],
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toHaveLength(2);
        expect(result.data.imageUrls[0]).toBe("https://existing.example.com/image1.jpg");
        expect(result.data.imageUrls[1]).toBe("https://storage.example.com/projects/test/new.jpg");
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
        files: [
          {
            name: "test.jpg",
            type: "image/jpeg",
            size: 1024,
            buffer: Buffer.from("test"),
          },
        ],
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
        files: [
          {
            name: "test.jpg",
            type: "image/jpeg",
            size: 1024,
            buffer: Buffer.from("test"),
          },
        ],
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("ファイルサイズが5MBを超える場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        files: [
          {
            name: "large.jpg",
            type: "image/jpeg",
            size: 6 * 1024 * 1024, // 6MB
            buffer: Buffer.from("large image"),
          },
        ],
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("5MB");
      }
    });

    it("サポートされていない形式の場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        files: [
          {
            name: "test.gif",
            type: "image/gif",
            size: 1024,
            buffer: Buffer.from("gif image"),
          },
        ],
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("形式");
      }
    });

    it("画像が10枚を超える場合エラーを返す", async () => {
      // Arrange
      const existingProject = mockProject.updateImages(
        Array(8).fill("https://example.com/image.jpg")
      );

      mockProjectRepository.findById.mockResolvedValue(existingProject);

      const newFiles = [
        {
          name: "new1.jpg",
          type: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("test1"),
        },
        {
          name: "new2.jpg",
          type: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("test2"),
        },
        {
          name: "new3.jpg",
          type: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("test3"),
        },
      ];

      // Act
      const result = await useCase.execute({
        projectId: existingProject.id.value,
        hostId: existingProject.hostId.value,
        files: newFiles,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("10");
      }
    });

    it("ファイルが選択されていない場合エラーを返す", async () => {
      // Arrange
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      // Act
      const result = await useCase.execute({
        projectId: mockProject.id.value,
        hostId: mockProject.hostId.value,
        files: [],
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
