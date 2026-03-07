import {
  PrismaClient,
  OwnerApplication as PrismaOwnerApplication,
  ApplicationStatus as PrismaApplicationStatus,
} from "@prisma/client";
import {
  OwnerApplication,
  ApplicationStatus,
} from "@/domain/application/entities/OwnerApplication";
import { OwnerApplicationRepository } from "@/domain/application/repositories/OwnerApplicationRepository";
import { ApplicationId } from "@/domain/application/value-objects/ApplicationId";

/**
 * PrismaOwnerApplicationRepository
 * OwnerApplicationRepository インターフェースの Prisma 実装
 */
export class PrismaOwnerApplicationRepository implements OwnerApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * IDで応募を検索
   */
  async findById(id: ApplicationId): Promise<OwnerApplication | null> {
    const record = await this.prisma.ownerApplication.findUnique({
      where: { id: id.toString() },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  /**
   * メールアドレスで応募を検索
   */
  async findByEmail(email: string): Promise<OwnerApplication[]> {
    const records = await this.prisma.ownerApplication.findMany({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => this.toDomain(r));
  }

  /**
   * ステータスで応募を検索
   */
  async findByStatus(status: ApplicationStatus): Promise<OwnerApplication[]> {
    const records = await this.prisma.ownerApplication.findMany({
      where: { status: this.toPrismaStatus(status) },
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => this.toDomain(r));
  }

  /**
   * 新規応募を保存
   */
  async create(application: OwnerApplication): Promise<OwnerApplication> {
    const record = await this.prisma.ownerApplication.create({
      data: {
        id: application.id.toString(),
        name: application.name,
        email: application.email,
        projectTitle: application.projectTitle,
        projectSummary: application.projectSummary,
        projectStory: application.projectStory,
        status: this.toPrismaStatus(application.status),
      },
    });

    return this.toDomain(record);
  }

  /**
   * 応募を更新
   */
  async update(application: OwnerApplication): Promise<OwnerApplication> {
    const record = await this.prisma.ownerApplication.update({
      where: { id: application.id.toString() },
      data: {
        name: application.name,
        email: application.email,
        projectTitle: application.projectTitle,
        projectSummary: application.projectSummary,
        projectStory: application.projectStory,
        status: this.toPrismaStatus(application.status),
      },
    });

    return this.toDomain(record);
  }

  /**
   * Prisma モデル → ドメインエンティティ
   */
  private toDomain(record: PrismaOwnerApplication): OwnerApplication {
    return OwnerApplication.reconstruct({
      id: ApplicationId.from(record.id),
      name: record.name,
      email: record.email,
      projectTitle: record.projectTitle,
      projectSummary: record.projectSummary,
      projectStory: record.projectStory,
      status: this.toDomainStatus(record.status),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  /**
   * ドメインステータス → Prisma ステータス
   */
  private toPrismaStatus(status: ApplicationStatus): PrismaApplicationStatus {
    const mapping: Record<ApplicationStatus, PrismaApplicationStatus> = {
      [ApplicationStatus.PENDING]: "PENDING",
      [ApplicationStatus.REVIEWING]: "REVIEWING",
      [ApplicationStatus.APPROVED]: "APPROVED",
      [ApplicationStatus.REJECTED]: "REJECTED",
    };
    return mapping[status];
  }

  /**
   * Prisma ステータス → ドメインステータス
   */
  private toDomainStatus(status: PrismaApplicationStatus): ApplicationStatus {
    const mapping: Record<PrismaApplicationStatus, ApplicationStatus> = {
      PENDING: ApplicationStatus.PENDING,
      REVIEWING: ApplicationStatus.REVIEWING,
      APPROVED: ApplicationStatus.APPROVED,
      REJECTED: ApplicationStatus.REJECTED,
    };
    return mapping[status];
  }
}
