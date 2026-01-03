import { Project, ProjectStatus, Category } from "./Project";
import { ProjectId } from "../value-objects/ProjectId";
import { UserId } from "../../account/value-objects/UserId";

describe("Project", () => {
  const createValidHostId = () => UserId.generate();
  const createValidProjectId = () => ProjectId.generate();

  describe("create", () => {
    it("should create a valid project in DRAFT status", () => {
      const result = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "古民家再生プロジェクト",
        summary: "築100年の古民家を再生するプロジェクトです",
        description: "詳細な説明文がここに入ります...",
        category: Category.KOMINKA,
        location: "新潟県十日町市",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("古民家再生プロジェクト");
        expect(result.data.status).toBe(ProjectStatus.DRAFT);
        expect(result.data.imageUrls).toEqual([]);
        expect(result.data.isFeatured).toBe(false);
        expect(result.data.slug).toBeNull();
        expect(result.data.publishedAt).toBeNull();
      }
    });

    it("should create project with optional image URLs", () => {
      const result = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "テストプロジェクト",
        summary: "概要",
        description: "詳細",
        category: Category.DIY,
        location: "東京都",
        imageUrls: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toEqual([
          "https://example.com/image1.jpg",
          "https://example.com/image2.jpg",
        ]);
      }
    });

    it("should return error for empty title", () => {
      const result = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "",
        summary: "概要",
        description: "詳細",
        category: Category.KOMINKA,
        location: "東京都",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("タイトル");
      }
    });

    it("should return error for empty summary", () => {
      const result = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "タイトル",
        summary: "",
        description: "詳細",
        category: Category.KOMINKA,
        location: "東京都",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("概要");
      }
    });

    it("should return error for empty description", () => {
      const result = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "タイトル",
        summary: "概要",
        description: "",
        category: Category.KOMINKA,
        location: "東京都",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("詳細説明");
      }
    });
  });

  describe("publish", () => {
    it("should publish a draft project", () => {
      const createResult = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "公開テストプロジェクト",
        summary: "概要",
        description: "詳細",
        category: Category.RICE_FARMING,
        location: "新潟県",
      });

      if (!createResult.success) throw new Error("Failed to create project");

      const publishResult = createResult.data.publish();

      expect(publishResult.success).toBe(true);
      if (publishResult.success) {
        expect(publishResult.data.status).toBe(ProjectStatus.PUBLISHED);
        expect(publishResult.data.publishedAt).not.toBeNull();
        expect(publishResult.data.slug).not.toBeNull();
        expect(publishResult.data.slug).toContain("公開テストプロジェクト");
      }
    });

    it("should return error when already published", () => {
      const createResult = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "テスト",
        summary: "概要",
        description: "詳細",
        category: Category.DIY,
        location: "東京都",
      });

      if (!createResult.success) throw new Error("Failed to create project");

      const publishResult = createResult.data.publish();
      if (!publishResult.success) throw new Error("Failed to publish");

      const secondPublishResult = publishResult.data.publish();

      expect(secondPublishResult.success).toBe(false);
      if (!secondPublishResult.success) {
        expect(secondPublishResult.error.code).toBe("VALIDATION_ERROR");
        expect(secondPublishResult.error.message).toContain("公開済み");
      }
    });
  });

  describe("unpublish", () => {
    it("should unpublish a published project", () => {
      const createResult = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "テスト",
        summary: "概要",
        description: "詳細",
        category: Category.CRAFT,
        location: "京都府",
      });

      if (!createResult.success) throw new Error("Failed to create project");

      const publishResult = createResult.data.publish();
      if (!publishResult.success) throw new Error("Failed to publish");

      const unpublishResult = publishResult.data.unpublish();

      expect(unpublishResult.success).toBe(true);
      if (unpublishResult.success) {
        expect(unpublishResult.data.status).toBe(ProjectStatus.DRAFT);
      }
    });

    it("should return error when already draft", () => {
      const createResult = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "テスト",
        summary: "概要",
        description: "詳細",
        category: Category.OTHER,
        location: "大阪府",
      });

      if (!createResult.success) throw new Error("Failed to create project");

      const unpublishResult = createResult.data.unpublish();

      expect(unpublishResult.success).toBe(false);
      if (!unpublishResult.success) {
        expect(unpublishResult.error.code).toBe("VALIDATION_ERROR");
        expect(unpublishResult.error.message).toContain("下書き");
      }
    });
  });

  describe("update", () => {
    it("should update project information", () => {
      const createResult = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "元のタイトル",
        summary: "元の概要",
        description: "元の詳細",
        category: Category.KOMINKA,
        location: "新潟県",
      });

      if (!createResult.success) throw new Error("Failed to create project");

      const updateResult = createResult.data.update({
        title: "新しいタイトル",
        summary: "新しい概要",
      });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.title).toBe("新しいタイトル");
        expect(updateResult.data.summary).toBe("新しい概要");
        expect(updateResult.data.description).toBe("元の詳細");
      }
    });

    it("should return error for empty title in update", () => {
      const createResult = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "元のタイトル",
        summary: "概要",
        description: "詳細",
        category: Category.KOMINKA,
        location: "新潟県",
      });

      if (!createResult.success) throw new Error("Failed to create project");

      const updateResult = createResult.data.update({ title: "" });

      expect(updateResult.success).toBe(false);
    });
  });

  describe("updateImages", () => {
    it("should update image URLs", () => {
      const createResult = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "テスト",
        summary: "概要",
        description: "詳細",
        category: Category.DIY,
        location: "東京都",
      });

      if (!createResult.success) throw new Error("Failed to create project");

      const updated = createResult.data.updateImages([
        "https://example.com/new1.jpg",
        "https://example.com/new2.jpg",
      ]);

      expect(updated.imageUrls).toEqual([
        "https://example.com/new1.jpg",
        "https://example.com/new2.jpg",
      ]);
    });
  });

  describe("isPublished", () => {
    it("should return false for draft project", () => {
      const createResult = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "テスト",
        summary: "概要",
        description: "詳細",
        category: Category.DIY,
        location: "東京都",
      });

      if (!createResult.success) throw new Error("Failed to create project");

      expect(createResult.data.isPublished()).toBe(false);
    });

    it("should return true for published project", () => {
      const createResult = Project.create({
        id: createValidProjectId(),
        hostId: createValidHostId(),
        title: "テスト",
        summary: "概要",
        description: "詳細",
        category: Category.DIY,
        location: "東京都",
      });

      if (!createResult.success) throw new Error("Failed to create project");

      const publishResult = createResult.data.publish();
      if (!publishResult.success) throw new Error("Failed to publish");

      expect(publishResult.data.isPublished()).toBe(true);
    });
  });

  describe("reconstruct", () => {
    it("should reconstruct a project from persisted data", () => {
      const id = createValidProjectId();
      const hostId = createValidHostId();
      const now = new Date();

      const project = Project.reconstruct({
        id,
        hostId,
        title: "再構築プロジェクト",
        summary: "概要",
        description: "詳細",
        category: Category.KOMINKA,
        location: "新潟県",
        imageUrls: ["https://example.com/image.jpg"],
        status: ProjectStatus.PUBLISHED,
        slug: "saiko-chiku-project-abc123",
        isFeatured: true,
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      });

      expect(project.id.value).toBe(id.value);
      expect(project.hostId.value).toBe(hostId.value);
      expect(project.title).toBe("再構築プロジェクト");
      expect(project.status).toBe(ProjectStatus.PUBLISHED);
      expect(project.slug).toBe("saiko-chiku-project-abc123");
      expect(project.isFeatured).toBe(true);
      expect(project.publishedAt).toBe(now);
    });
  });
});
