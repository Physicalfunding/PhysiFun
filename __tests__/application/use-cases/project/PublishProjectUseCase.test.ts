/**
 * PublishProjectUseCase テスト
 */
import {
  PublishProjectUseCase,
  PublishProjectInput,
} from "@/application/use-cases/project/PublishProjectUseCase";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Project, Category, ProjectStatus } from "@/domain/project/entities/Project";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

// テスト用プロジェクトの作成ヘルパー
const createTestProject = (
  overrides: Partial<{
    hostId: UserId;
    status: ProjectStatus;
  }> = {}
): Project => {
  const projectId = ProjectId.generate();
  const hostId = overrides.hostId ?? UserId.generate();
  const status = overrides.status ?? ProjectStatus.DRAFT;

  return Project.reconstruct({
    id: projectId,
    hostId,
    title: "テストプロジェクト",
    summary: "テスト概要",
    description: "テスト詳細説明",
    category: Category.KOMINKA,
    location: "新潟県",
    imageUrls: [],
    status,
    slug: status === ProjectStatus.PUBLISHED ? "test-slug" : null,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: status === ProjectStatus.PUBLISHED ? new Date() : null,
  });
};

// モックリポジトリの作成
const createMockProjectRepository = (
  overrides: Partial<ProjectRepository> = {}
): ProjectRepository => ({
  findById: jest.fn().mockResolvedValue(null),
  findBySlug: jest.fn().mockResolvedValue(null),
  findByHostId: jest.fn().mockResolvedValue([]),
  findPublished: jest
    .fn()
    .mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, hasNext: false }),
  findAllPublished: jest.fn().mockResolvedValue([]),
  findFeatured: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation(async (project: Project) => project),
  update: jest.fn().mockImplementation(async (project: Project) => project),
  delete: jest.fn().mockResolvedValue(undefined),
  countByHostId: jest.fn().mockResolvedValue(0),
  ...overrides,
});

describe("PublishProjectUseCase", () => {
  describe("execute", () => {
    it("should publish a draft project successfully", async () => {
      // Arrange
      const hostId = UserId.generate();
      const project = createTestProject({ hostId, status: ProjectStatus.DRAFT });
      const mockRepo = createMockProjectRepository({
        findById: jest.fn().mockResolvedValue(project),
      });
      const useCase = new PublishProjectUseCase(mockRepo);

      const input: PublishProjectInput = {
        projectId: project.id.value,
        hostId: hostId.value,
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("PUBLISHED");
        expect(result.data.slug).toBeDefined();
        expect(result.data.publishedAt).toBeDefined();
      }
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it("should return error when project not found", async () => {
      // Arrange
      const mockRepo = createMockProjectRepository({
        findById: jest.fn().mockResolvedValue(null),
      });
      const useCase = new PublishProjectUseCase(mockRepo);

      const input: PublishProjectInput = {
        projectId: ProjectId.generate().value,
        hostId: UserId.generate().value,
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
      const useCase = new PublishProjectUseCase(mockRepo);

      const input: PublishProjectInput = {
        projectId: project.id.value,
        hostId: otherUserId.value,
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("should return error when project is already published", async () => {
      // Arrange
      const hostId = UserId.generate();
      const project = createTestProject({ hostId, status: ProjectStatus.PUBLISHED });
      const mockRepo = createMockProjectRepository({
        findById: jest.fn().mockResolvedValue(project),
      });
      const useCase = new PublishProjectUseCase(mockRepo);

      const input: PublishProjectInput = {
        projectId: project.id.value,
        hostId: hostId.value,
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
