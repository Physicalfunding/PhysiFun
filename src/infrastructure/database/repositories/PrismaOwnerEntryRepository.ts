import {
  PrismaClient,
  OwnerEntry as PrismaOwnerEntry,
  EntryStatus as PrismaEntryStatus,
} from "@prisma/client";
import { OwnerEntry, EntryStatus } from "@/domain/entry/entities/OwnerEntry";
import { OwnerEntryRepository } from "@/domain/entry/repositories/OwnerEntryRepository";
import { EntryId } from "@/domain/entry/value-objects/EntryId";

/**
 * PrismaOwnerEntryRepository
 * OwnerEntryRepository インターフェースの Prisma 実装
 */
export class PrismaOwnerEntryRepository implements OwnerEntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * IDで応募を検索
   */
  async findById(id: EntryId): Promise<OwnerEntry | null> {
    const record = await this.prisma.ownerEntry.findUnique({
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
  async findByEmail(email: string): Promise<OwnerEntry[]> {
    const records = await this.prisma.ownerEntry.findMany({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => this.toDomain(r));
  }

  /**
   * ステータスで応募を検索
   */
  async findByStatus(status: EntryStatus): Promise<OwnerEntry[]> {
    const records = await this.prisma.ownerEntry.findMany({
      where: { status: this.toPrismaStatus(status) },
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => this.toDomain(r));
  }

  /**
   * 新規応募を保存
   */
  async create(entry: OwnerEntry): Promise<OwnerEntry> {
    const record = await this.prisma.ownerEntry.create({
      data: {
        id: entry.id.toString(),
        name: entry.name,
        email: entry.email,
        projectTitle: entry.projectTitle,
        projectSummary: entry.projectSummary,
        projectStory: entry.projectStory,
        status: this.toPrismaStatus(entry.status),
      },
    });

    return this.toDomain(record);
  }

  /**
   * 応募を更新
   */
  async update(entry: OwnerEntry): Promise<OwnerEntry> {
    const record = await this.prisma.ownerEntry.update({
      where: { id: entry.id.toString() },
      data: {
        name: entry.name,
        email: entry.email,
        projectTitle: entry.projectTitle,
        projectSummary: entry.projectSummary,
        projectStory: entry.projectStory,
        status: this.toPrismaStatus(entry.status),
      },
    });

    return this.toDomain(record);
  }

  /**
   * Prisma モデル → ドメインエンティティ
   */
  private toDomain(record: PrismaOwnerEntry): OwnerEntry {
    return OwnerEntry.reconstruct({
      id: EntryId.from(record.id),
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
  private toPrismaStatus(status: EntryStatus): PrismaEntryStatus {
    const mapping: Record<EntryStatus, PrismaEntryStatus> = {
      [EntryStatus.PENDING]: "PENDING",
      [EntryStatus.REVIEWING]: "REVIEWING",
      [EntryStatus.APPROVED]: "APPROVED",
      [EntryStatus.REJECTED]: "REJECTED",
    };
    return mapping[status];
  }

  /**
   * Prisma ステータス → ドメインステータス
   */
  private toDomainStatus(status: PrismaEntryStatus): EntryStatus {
    const mapping: Record<PrismaEntryStatus, EntryStatus> = {
      PENDING: EntryStatus.PENDING,
      REVIEWING: EntryStatus.REVIEWING,
      APPROVED: EntryStatus.APPROVED,
      REJECTED: EntryStatus.REJECTED,
    };
    return mapping[status];
  }
}
