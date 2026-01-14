/**
 * GetFeaturedProjectsUseCase テスト
 * ホームページ表示用プロジェクト取得機能のユニットテスト
 */
import { GetFeaturedProjectsUseCase } from "@/application/use-cases/guest/GetFeaturedProjectsUseCase";
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

describe("GetFeaturedProjectsUseCase", () => {
  let useCase: GetFeaturedProjectsUseCase;
  let mockProjects: Project[];

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetFeaturedProjectsUseCase(mockProjectRepository);

    mockProjects = [
      Project.reconstruct({
        id: ProjectId.generate(),
        hostId: UserId.generate(),
        title: "古民家再生体験",
        summary: "日本の伝統建築を学べる体験",
        description: "テストの詳細説明です。50文字以上の説明文が必要なので長めに書いています。",
        category: Category.KOMINKA,
        location: "京都府",
        imageUrls: ["https://example.com/image1.jpg"],
        status: ProjectStatus.PUBLISHED,
        slug: "kominka-saisei",
        isFeatured: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      }),
      Project.reconstruct({
        id: ProjectId.generate(),
        hostId: UserId.generate(),
        title: "農業体験ツアー",
        summary: "田舎での農業体験",
        description: "テストの詳細説明です。50文字以上の説明文が必要なので長めに書いています。",
        category: Category.RICE_FARMING,
        location: "長野県",
        imageUrls: ["https://example.com/image2.jpg"],
        status: ProjectStatus.PUBLISHED,
        slug: "nogyo-taiken",
        isFeatured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      }),
    ];
  });

  describe("正常系", () => {
    it("ピックアッププロジェクトを取得できる", async () => {
      // Arrange
      const featuredProjects = mockProjects.filter((p) => p.isFeatured);
      mockProjectRepository.findFeatured.mockResolvedValue(featuredProjects);
      mockProjectRepository.findPublished.mockResolvedValue({
        items: mockProjects,
        total: 2,
        page: 1,
        limit: 10,
        hasNext: false,
      });

      // Act
      const result = await useCase.execute({});

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.featured).toHaveLength(1);
        expect(result.data.featured[0].title).toBe("古民家再生体験");
      }
    });

    it("最新のプロジェクト一覧を取得できる", async () => {
      // Arrange
      mockProjectRepository.findFeatured.mockResolvedValue([]);
      mockProjectRepository.findPublished.mockResolvedValue({
        items: mockProjects,
        total: 2,
        page: 1,
        limit: 10,
        hasNext: false,
      });

      // Act
      const result = await useCase.execute({});

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recent).toHaveLength(2);
      }
    });

    it("カテゴリでフィルタリングできる", async () => {
      // Arrange
      const kominkaProjects = mockProjects.filter((p) => p.category === Category.KOMINKA);
      mockProjectRepository.findFeatured.mockResolvedValue([]);
      mockProjectRepository.findPublished.mockResolvedValue({
        items: kominkaProjects,
        total: 1,
        page: 1,
        limit: 10,
        hasNext: false,
      });

      // Act
      const result = await useCase.execute({ category: Category.KOMINKA });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recent).toHaveLength(1);
        expect(result.data.recent[0].category).toBe(Category.KOMINKA);
      }
      expect(mockProjectRepository.findPublished).toHaveBeenCalledWith(
        expect.objectContaining({ category: Category.KOMINKA })
      );
    });

    it("地域でフィルタリングできる", async () => {
      // Arrange
      const kyotoProjects = mockProjects.filter((p) => p.location === "京都府");
      mockProjectRepository.findFeatured.mockResolvedValue([]);
      mockProjectRepository.findPublished.mockResolvedValue({
        items: kyotoProjects,
        total: 1,
        page: 1,
        limit: 10,
        hasNext: false,
      });

      // Act
      const result = await useCase.execute({ location: "京都府" });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recent).toHaveLength(1);
        expect(result.data.recent[0].location).toBe("京都府");
      }
    });

    it("プロジェクトがない場合は空配列を返す", async () => {
      // Arrange
      mockProjectRepository.findFeatured.mockResolvedValue([]);
      mockProjectRepository.findPublished.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        hasNext: false,
      });

      // Act
      const result = await useCase.execute({});

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.featured).toHaveLength(0);
        expect(result.data.recent).toHaveLength(0);
      }
    });
  });
});
