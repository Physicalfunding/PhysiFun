/**
 * CreateProjectUseCase テスト
 * TDD: REDフェーズ - 失敗するテストを先に作成
 *
 * テスト対象:
 * - プロジェクトの新規作成（下書き状態での保存）
 * - ホスト1アカウントにつき同時に1プロジェクトのみの制限
 */
import {
  CreateProjectUseCase,
  CreateProjectInput,
} from "@/application/use-cases/project/CreateProjectUseCase";
import { ProjectRepository } from "@/domain/project/repositories/ProjectRepository";
import { Project, Category, ProjectStatus } from "@/domain/project/entities/Project";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

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

describe("CreateProjectUseCase", () => {
  const validHostId = UserId.generate();

  const createValidInput = (overrides: Partial<CreateProjectInput> = {}): CreateProjectInput => ({
    hostId: validHostId.value,
    title: "古民家再生プロジェクト",
    summary: "築100年の古民家を再生するプロジェクトです",
    description:
      "詳細な説明文がここに入ります。長文でも対応できるようにします。プロジェクトの背景、目的、期待される成果などを記載します。",
    category: "KOMINKA",
    location: "新潟県十日町市",
    ...overrides,
  });

  describe("execute", () => {
    it("should create a new project successfully in DRAFT status", async () => {
      // Arrange
      const mockRepo = createMockProjectRepository();
      const useCase = new CreateProjectUseCase(mockRepo);
      const input = createValidInput();

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBeDefined();
        expect(result.data.title).toBe(input.title);
        expect(result.data.summary).toBe(input.summary);
        expect(result.data.description).toBe(input.description);
        expect(result.data.category).toBe(input.category);
        expect(result.data.location).toBe(input.location);
        expect(result.data.status).toBe("DRAFT");
      }
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it("should return error when host already has an active project", async () => {
      // Arrange: ホストが既に1つのプロジェクトを持っている状態
      const mockRepo = createMockProjectRepository({
        countByHostId: jest.fn().mockResolvedValue(1),
      });
      const useCase = new CreateProjectUseCase(mockRepo);
      const input = createValidInput();

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("プロジェクト");
      }
    });

    it("should return error for invalid host ID", async () => {
      // Arrange
      const mockRepo = createMockProjectRepository();
      const useCase = new CreateProjectUseCase(mockRepo);
      const input = createValidInput({ hostId: "invalid-id" });

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should return error for empty title", async () => {
      // Arrange
      const mockRepo = createMockProjectRepository();
      const useCase = new CreateProjectUseCase(mockRepo);
      const input = createValidInput({ title: "" });

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("タイトル");
      }
    });

    it("should return error for empty summary", async () => {
      // Arrange
      const mockRepo = createMockProjectRepository();
      const useCase = new CreateProjectUseCase(mockRepo);
      const input = createValidInput({ summary: "" });

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("概要");
      }
    });

    it("should return error for empty description", async () => {
      // Arrange
      const mockRepo = createMockProjectRepository();
      const useCase = new CreateProjectUseCase(mockRepo);
      const input = createValidInput({ description: "" });

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("詳細説明");
      }
    });

    it("should return error for invalid category", async () => {
      // Arrange
      const mockRepo = createMockProjectRepository();
      const useCase = new CreateProjectUseCase(mockRepo);
      const input = createValidInput({ category: "INVALID_CATEGORY" as Category });

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should accept all valid categories", async () => {
      const validCategories: Category[] = ["KOMINKA", "RICE_FARMING", "DIY", "CRAFT", "OTHER"];
      const mockRepo = createMockProjectRepository();
      const useCase = new CreateProjectUseCase(mockRepo);

      for (const category of validCategories) {
        const input = createValidInput({ category });
        const result = await useCase.execute(input);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.category).toBe(category);
        }
      }
    });
  });
});
