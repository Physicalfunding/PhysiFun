/**
 * UpdateProjectUseCase テスト
 * TDD: REDフェーズ - 失敗するテストを先に作成
 */
import { UpdateProjectUseCase, UpdateProjectInput } from "@/application/use-cases/project/UpdateProjectUseCase";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Project, Category, ProjectStatus } from "@/domain/project/entities/Project";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

// テスト用プロジェクトの作成ヘルパー
const createTestProject = (overrides: Partial<{
  hostId: UserId;
  status: ProjectStatus;
}> = {}): Project => {
  const projectId = ProjectId.generate();
  const hostId = overrides.hostId ?? UserId.generate();

  return Project.reconstruct({
    id: projectId,
    hostId,
    title: "元のタイトル",
    summary: "元の概要",
    description: "元の詳細説明",
    category: Category.KOMINKA,
    location: "新潟県十日町市",
    imageUrls: [],
    status: overrides.status ?? ProjectStatus.DRAFT,
    slug: null,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
  });
};

// モックリポジトリの作成
const createMockProjectRepository = (
  overrides: Partial<ProjectRepository> = {}
): ProjectRepository => ({
  findById: jest.fn().mockResolvedValue(null),
  findBySlug: jest.fn().mockResolvedValue(null),
  findByHostId: jest.fn().mockResolvedValue([]),
  findPublished: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, hasNext: false }),
  findAllPublished: jest.fn().mockResolvedValue([]),
  findFeatured: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation(async (project: Project) => project),
  update: jest.fn().mockImplementation(async (project: Project) => project),
  delete: jest.fn().mockResolvedValue(undefined),
  countByHostId: jest.fn().mockResolvedValue(0),
  ...overrides,
});

describe("UpdateProjectUseCase", () => {
  describe("execute", () => {
    it("should update project information successfully", async () => {
      // Arrange
      const hostId = UserId.generate();
      const project = createTestProject({ hostId });
      const mockRepo = createMockProjectRepository({
        findById: jest.fn().mockResolvedValue(project),
      });
      const useCase = new UpdateProjectUseCase(mockRepo);

      const input: UpdateProjectInput = {
        projectId: project.id.value,
        hostId: hostId.value,
        title: "新しいタイトル",
        summary: "新しい概要",
        description: "新しい詳細説明",
        category: Category.DIY,
        location: "東京都",
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("新しいタイトル");
        expect(result.data.summary).toBe("新しい概要");
        expect(result.data.description).toBe("新しい詳細説明");
        expect(result.data.category).toBe(Category.DIY);
        expect(result.data.location).toBe("東京都");
      }
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it("should update only specified fields", async () => {
      // Arrange
      const hostId = UserId.generate();
      const project = createTestProject({ hostId });
      const mockRepo = createMockProjectRepository({
        findById: jest.fn().mockResolvedValue(project),
      });
      const useCase = new UpdateProjectUseCase(mockRepo);

      const input: UpdateProjectInput = {
        projectId: project.id.value,
        hostId: hostId.value,
        title: "タイトルだけ更新",
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("タイトルだけ更新");
        expect(result.data.summary).toBe("元の概要");
      }
    });

    it("should return error when project not found", async () => {
      // Arrange
      const mockRepo = createMockProjectRepository({
        findById: jest.fn().mockResolvedValue(null),
      });
      const useCase = new UpdateProjectUseCase(mockRepo);

      const input: UpdateProjectInput = {
        projectId: ProjectId.generate().value,
        hostId: UserId.generate().value,
        title: "新しいタイトル",
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return error when user is not the owner", async () => {
      // Arrange
      const ownerHostId = UserId.generate();
      const otherUserId = UserId.generate();
      const project = createTestProject({ hostId: ownerHostId });
      const mockRepo = createMockProjectRepository({
        findById: jest.fn().mockResolvedValue(project),
      });
      const useCase = new UpdateProjectUseCase(mockRepo);

      const input: UpdateProjectInput = {
        projectId: project.id.value,
        hostId: otherUserId.value, // 別のユーザー
        title: "不正な更新",
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("should return error for empty title", async () => {
      // Arrange
      const hostId = UserId.generate();
      const project = createTestProject({ hostId });
      const mockRepo = createMockProjectRepository({
        findById: jest.fn().mockResolvedValue(project),
      });
      const useCase = new UpdateProjectUseCase(mockRepo);

      const input: UpdateProjectInput = {
        projectId: project.id.value,
        hostId: hostId.value,
        title: "",
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
