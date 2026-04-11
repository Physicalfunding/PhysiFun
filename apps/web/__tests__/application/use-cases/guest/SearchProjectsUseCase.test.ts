/**
 * SearchProjectsUseCase テスト
 * プロジェクト検索機能のユニットテスト
 */
import { SearchProjectsUseCase } from "@/application/use-cases/guest/SearchProjectsUseCase";
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

describe("SearchProjectsUseCase", () => {
  let useCase: SearchProjectsUseCase;
  let mockProjects: Project[];

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new SearchProjectsUseCase(mockProjectRepository);

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
    it("キーワードで検索できる", async () => {
      // Arrange
      mockProjectRepository.findPublished.mockResolvedValue({
        items: [mockProjects[0]],
        total: 1,
        page: 1,
        limit: 10,
        hasNext: false,
      });

      // Act
      const result = await useCase.execute({ keyword: "古民家" });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(1);
        expect(result.data.items[0].title).toBe("古民家再生体験");
      }
      expect(mockProjectRepository.findPublished).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: "古民家" })
      );
    });

    it("カテゴリでフィルタリングできる", async () => {
      // Arrange
      mockProjectRepository.findPublished.mockResolvedValue({
        items: [mockProjects[1]],
        total: 1,
        page: 1,
        limit: 10,
        hasNext: false,
      });

      // Act
      const result = await useCase.execute({ category: Category.RICE_FARMING });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(1);
        expect(result.data.items[0].category).toBe(Category.RICE_FARMING);
      }
    });

    it("地域でフィルタリングできる", async () => {
      // Arrange
      mockProjectRepository.findPublished.mockResolvedValue({
        items: [mockProjects[0]],
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
        expect(result.data.items).toHaveLength(1);
        expect(result.data.items[0].location).toBe("京都府");
      }
    });

    it("ページネーション情報を返す", async () => {
      // Arrange
      mockProjectRepository.findPublished.mockResolvedValue({
        items: mockProjects,
        total: 25,
        page: 1,
        limit: 10,
        hasNext: true,
      });

      // Act
      const result = await useCase.execute({ page: 1, limit: 10 });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(25);
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
        expect(result.data.hasNext).toBe(true);
      }
    });

    it("複合条件で検索できる", async () => {
      // Arrange
      mockProjectRepository.findPublished.mockResolvedValue({
        items: [mockProjects[0]],
        total: 1,
        page: 1,
        limit: 10,
        hasNext: false,
      });

      // Act
      const result = await useCase.execute({
        keyword: "体験",
        category: Category.KOMINKA,
        location: "京都府",
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockProjectRepository.findPublished).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: "体験",
          category: Category.KOMINKA,
          location: "京都府",
        })
      );
    });

    it("検索結果がない場合は空配列を返す", async () => {
      // Arrange
      mockProjectRepository.findPublished.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        hasNext: false,
      });

      // Act
      const result = await useCase.execute({ keyword: "存在しないキーワード" });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(0);
        expect(result.data.total).toBe(0);
      }
    });
  });
});
