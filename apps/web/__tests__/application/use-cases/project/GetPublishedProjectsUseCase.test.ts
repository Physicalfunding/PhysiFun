import { GetPublishedProjectsUseCase } from "@/application/use-cases/project/GetPublishedProjectsUseCase";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Project, ProjectStatus, Category } from "@/domain/project/entities/Project";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * テスト用のモックリポジトリ
 */
const createMockProjectRepository = (): jest.Mocked<ProjectRepository> => ({
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
});

/**
 * テスト用のプロジェクトを作成するヘルパー関数
 * ProjectId.generate() を使用してUUID形式のIDを生成
 */
const createTestProject = (
  title: string,
  category: Category = Category.OTHER,
  location: string = "東京都"
): Project => {
  // generate() を使用してUUID形式のIDを生成
  const projectId = ProjectId.generate();
  const hostId = UserId.generate();

  return Project.reconstruct({
    id: projectId,
    hostId: hostId,
    title,
    summary: `${title}の概要`,
    description: `${title}の詳細説明`,
    category,
    location,
    imageUrls: ["https://example.com/image.jpg"],
    status: ProjectStatus.PUBLISHED,
    slug: `${title.toLowerCase().replace(/\s+/g, "-")}-abc123`,
    isFeatured: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    publishedAt: new Date("2026-01-01"),
  });
};

describe("GetPublishedProjectsUseCase", () => {
  let useCase: GetPublishedProjectsUseCase;
  let mockProjectRepository: jest.Mocked<ProjectRepository>;

  beforeEach(() => {
    mockProjectRepository = createMockProjectRepository();
    useCase = new GetPublishedProjectsUseCase(mockProjectRepository);
  });

  describe("execute", () => {
    it("公開中のプロジェクト一覧を取得できること", async () => {
      // Arrange: 公開中のプロジェクトを2件用意
      const project1 = createTestProject("古民家再生プロジェクト", Category.KOMINKA, "長野県");
      const project2 = createTestProject("田んぼ体験プロジェクト", Category.RICE_FARMING, "新潟県");
      mockProjectRepository.findAllPublished.mockResolvedValue([project1, project2]);

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projects).toHaveLength(2);
        expect(result.data.projects[0].title).toBe("古民家再生プロジェクト");
        expect(result.data.projects[0].category).toBe(Category.KOMINKA);
        expect(result.data.projects[0].location).toBe("長野県");
        expect(result.data.projects[1].title).toBe("田んぼ体験プロジェクト");
      }
      expect(mockProjectRepository.findAllPublished).toHaveBeenCalledTimes(1);
    });

    it("プロジェクトがない場合は空の配列を返すこと", async () => {
      // Arrange: プロジェクトなし
      mockProjectRepository.findAllPublished.mockResolvedValue([]);

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projects).toHaveLength(0);
      }
    });

    it("プロジェクトデータが正しくDTO形式に変換されること", async () => {
      // Arrange
      const project = createTestProject("DIY体験", Category.DIY, "埼玉県");
      mockProjectRepository.findAllPublished.mockResolvedValue([project]);

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const projectDto = result.data.projects[0];
        // IDはUUID形式で動的に生成されるので存在確認のみ
        expect(projectDto.id).toBeDefined();
        expect(projectDto.title).toBe("DIY体験");
        expect(projectDto.summary).toBe("DIY体験の概要");
        expect(projectDto.category).toBe(Category.DIY);
        expect(projectDto.location).toBe("埼玉県");
        expect(projectDto.imageUrl).toBe("https://example.com/image.jpg");
      }
    });

    it("画像がない場合はnullが返されること", async () => {
      // Arrange: 画像なしのプロジェクト
      const projectId = ProjectId.generate();
      const hostId = UserId.generate();

      const projectWithoutImage = Project.reconstruct({
        id: projectId,
        hostId: hostId,
        title: "画像なしプロジェクト",
        summary: "概要",
        description: "詳細",
        category: Category.OTHER,
        location: "東京都",
        imageUrls: [], // 画像なし
        status: ProjectStatus.PUBLISHED,
        slug: "no-image-project",
        isFeatured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      });

      mockProjectRepository.findAllPublished.mockResolvedValue([projectWithoutImage]);

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projects[0].imageUrl).toBeNull();
      }
    });

    it("リポジトリでエラーが発生した場合はINTERNAL_ERRORを返すこと", async () => {
      // Arrange
      mockProjectRepository.findAllPublished.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INTERNAL_ERROR");
        expect(result.error.message).toBe("プロジェクト一覧の取得に失敗しました");
      }
    });
  });
});
