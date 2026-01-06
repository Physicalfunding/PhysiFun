import {
  PrismaClient,
  Project as PrismaProject,
  ProjectStatus as PrismaProjectStatus,
} from "@prisma/client";
import { Project, ProjectStatus, Category } from "@/domain/project/entities/Project";
import {
  ProjectRepository,
  ProjectFilter,
  PaginatedResult,
} from "@/domain/project/repositories/ProjectRepository";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * PrismaProjectRepository
 * ProjectRepositoryインターフェースのPrisma実装
 * ドメインエンティティとPrismaモデル間の変換を担当
 */
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * IDでプロジェクトを検索
   */
  async findById(id: ProjectId): Promise<Project | null> {
    const prismaProject = await this.prisma.project.findUnique({
      where: { id: id.value },
    });

    if (!prismaProject) {
      return null;
    }

    return this.toDomain(prismaProject);
  }

  /**
   * スラッグでプロジェクトを検索
   */
  async findBySlug(slug: string): Promise<Project | null> {
    const prismaProject = await this.prisma.project.findUnique({
      where: { slug },
    });

    if (!prismaProject) {
      return null;
    }

    return this.toDomain(prismaProject);
  }

  /**
   * ホストIDでプロジェクトを検索
   */
  async findByHostId(hostId: UserId): Promise<Project[]> {
    const prismaProjects = await this.prisma.project.findMany({
      where: { hostId: hostId.value },
      orderBy: { createdAt: "desc" },
    });

    return prismaProjects.map((p) => this.toDomain(p));
  }

  /**
   * 公開中のプロジェクトをフィルター条件で検索
   */
  async findPublished(filter: ProjectFilter): Promise<PaginatedResult<Project>> {
    // フィルター条件の構築
    const where: {
      status: PrismaProjectStatus;
      OR?: Array<{
        title?: { contains: string; mode: "insensitive" };
        summary?: { contains: string; mode: "insensitive" };
        description?: { contains: string; mode: "insensitive" };
      }>;
      category?: string;
      location?: { contains: string; mode: "insensitive" };
    } = {
      status: "PUBLISHED",
    };

    if (filter.keyword) {
      where.OR = [
        { title: { contains: filter.keyword, mode: "insensitive" } },
        { summary: { contains: filter.keyword, mode: "insensitive" } },
        { description: { contains: filter.keyword, mode: "insensitive" } },
      ];
    }

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.location) {
      where.location = { contains: filter.location, mode: "insensitive" };
    }

    // 総件数を取得
    const total = await this.prisma.project.count({ where });

    // ページネーション付きでデータを取得
    const prismaProjects = await this.prisma.project.findMany({
      where,
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
      orderBy: { publishedAt: "desc" },
    });

    const projects = prismaProjects.map((p) => this.toDomain(p));

    return {
      items: projects,
      total,
      page: filter.page,
      limit: filter.limit,
      hasNext: filter.page * filter.limit < total,
    };
  }

  /**
   * 公開中の全プロジェクトを取得（シンプル版）
   * ホームページ表示用
   */
  async findAllPublished(): Promise<Project[]> {
    const prismaProjects = await this.prisma.project.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
    });

    return prismaProjects.map((p) => this.toDomain(p));
  }

  /**
   * ピックアップ（注目）プロジェクトを取得
   */
  async findFeatured(): Promise<Project[]> {
    const prismaProjects = await this.prisma.project.findMany({
      where: {
        status: "PUBLISHED",
        isFeatured: true,
      },
      orderBy: { publishedAt: "desc" },
    });

    return prismaProjects.map((p) => this.toDomain(p));
  }

  /**
   * 新規プロジェクトを作成
   */
  async create(project: Project): Promise<Project> {
    const prismaProject = await this.prisma.project.create({
      data: {
        id: project.id.value,
        hostId: project.hostId.value,
        title: project.title,
        summary: project.summary,
        description: project.description,
        category: project.category,
        location: project.location,
        imageUrls: project.imageUrls,
        status: this.toPrismaStatus(project.status),
        slug: project.slug,
        isFeatured: project.isFeatured,
        publishedAt: project.publishedAt,
      },
    });

    return this.toDomain(prismaProject);
  }

  /**
   * プロジェクト情報を更新
   */
  async update(project: Project): Promise<Project> {
    const prismaProject = await this.prisma.project.update({
      where: { id: project.id.value },
      data: {
        title: project.title,
        summary: project.summary,
        description: project.description,
        category: project.category,
        location: project.location,
        imageUrls: project.imageUrls,
        status: this.toPrismaStatus(project.status),
        slug: project.slug,
        isFeatured: project.isFeatured,
        publishedAt: project.publishedAt,
      },
    });

    return this.toDomain(prismaProject);
  }

  /**
   * プロジェクトを削除
   */
  async delete(id: ProjectId): Promise<void> {
    await this.prisma.project.delete({
      where: { id: id.value },
    });
  }

  /**
   * ホストが持つプロジェクト数をカウント
   */
  async countByHostId(hostId: UserId, status?: ProjectStatus): Promise<number> {
    const where: { hostId: string; status?: PrismaProjectStatus } = {
      hostId: hostId.value,
    };

    if (status) {
      where.status = this.toPrismaStatus(status);
    }

    return this.prisma.project.count({ where });
  }

  /**
   * Prismaモデルからドメインエンティティへのマッピング
   */
  private toDomain(prismaProject: PrismaProject): Project {
    // ProjectId値オブジェクトの復元
    const projectIdResult = ProjectId.create(prismaProject.id);
    if (!projectIdResult.success) {
      throw new Error(`Invalid projectId in database: ${prismaProject.id}`);
    }

    // UserId値オブジェクトの復元
    const hostIdResult = UserId.create(prismaProject.hostId);
    if (!hostIdResult.success) {
      throw new Error(`Invalid hostId in database: ${prismaProject.hostId}`);
    }

    // ドメインエンティティの復元
    return Project.reconstruct({
      id: projectIdResult.data,
      hostId: hostIdResult.data,
      title: prismaProject.title,
      summary: prismaProject.summary,
      description: prismaProject.description,
      category: this.toDomainCategory(prismaProject.category),
      location: prismaProject.location,
      imageUrls: prismaProject.imageUrls,
      status: this.toDomainStatus(prismaProject.status),
      slug: prismaProject.slug,
      isFeatured: prismaProject.isFeatured,
      createdAt: prismaProject.createdAt,
      updatedAt: prismaProject.updatedAt,
      publishedAt: prismaProject.publishedAt,
    });
  }

  /**
   * ドメインProjectStatusからPrismaProjectStatusへの変換
   */
  private toPrismaStatus(status: ProjectStatus): PrismaProjectStatus {
    switch (status) {
      case ProjectStatus.DRAFT:
        return "DRAFT";
      case ProjectStatus.PUBLISHED:
        return "PUBLISHED";
    }
  }

  /**
   * PrismaProjectStatusからドメインProjectStatusへの変換
   */
  private toDomainStatus(prismaStatus: PrismaProjectStatus): ProjectStatus {
    switch (prismaStatus) {
      case "DRAFT":
        return ProjectStatus.DRAFT;
      case "PUBLISHED":
        return ProjectStatus.PUBLISHED;
    }
  }

  /**
   * 文字列からドメインCategoryへの変換
   * DBに保存されているカテゴリ文字列をドメイン型に変換
   */
  private toDomainCategory(categoryStr: string): Category {
    switch (categoryStr) {
      case "KOMINKA":
        return Category.KOMINKA;
      case "RICE_FARMING":
        return Category.RICE_FARMING;
      case "DIY":
        return Category.DIY;
      case "CRAFT":
        return Category.CRAFT;
      default:
        return Category.OTHER;
    }
  }
}
