import { PrismaClient, Return as PrismaReturn } from "@prisma/client";
import { Return } from "@/domain/project/entities/Return";
import { ReturnRepository } from "@/domain/project/repositories/ReturnRepository";
import { ReturnId } from "@/domain/project/value-objects/ReturnId";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";

/**
 * PrismaReturnRepository
 * ReturnRepositoryインターフェースのPrisma実装
 */
export class PrismaReturnRepository implements ReturnRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * IDでリターンを検索
   */
  async findById(id: ReturnId): Promise<Return | null> {
    const prismaReturn = await this.prisma.return.findUnique({
      where: { id: id.value },
    });

    if (!prismaReturn) {
      return null;
    }

    return this.toDomain(prismaReturn);
  }

  /**
   * プロジェクトIDでリターン一覧を取得
   */
  async findByProjectId(projectId: ProjectId): Promise<Return[]> {
    const prismaReturns = await this.prisma.return.findMany({
      where: { projectId: projectId.value },
      orderBy: { order: "asc" },
    });

    return prismaReturns.map((r) => this.toDomain(r));
  }

  /**
   * 新規リターンを作成
   */
  async create(returnEntity: Return): Promise<Return> {
    const prismaReturn = await this.prisma.return.create({
      data: {
        id: returnEntity.id.value,
        projectId: returnEntity.projectId.value,
        name: returnEntity.name,
        description: returnEntity.description,
        estimatedDeliveryDate: returnEntity.estimatedDeliveryDate,
        quantityLimit: returnEntity.quantityLimit,
        order: returnEntity.order,
      },
    });

    return this.toDomain(prismaReturn);
  }

  /**
   * リターン情報を更新
   */
  async update(returnEntity: Return): Promise<Return> {
    const prismaReturn = await this.prisma.return.update({
      where: { id: returnEntity.id.value },
      data: {
        name: returnEntity.name,
        description: returnEntity.description,
        estimatedDeliveryDate: returnEntity.estimatedDeliveryDate,
        quantityLimit: returnEntity.quantityLimit,
        order: returnEntity.order,
      },
    });

    return this.toDomain(prismaReturn);
  }

  /**
   * リターンを削除
   */
  async delete(id: ReturnId): Promise<void> {
    await this.prisma.return.delete({
      where: { id: id.value },
    });
  }

  /**
   * プロジェクトのリターン数をカウント
   */
  async countByProjectId(projectId: ProjectId): Promise<number> {
    return this.prisma.return.count({
      where: { projectId: projectId.value },
    });
  }

  /**
   * プロジェクトのリターン順序を一括更新
   */
  async updateOrder(projectId: ProjectId, orderedIds: ReturnId[]): Promise<void> {
    // トランザクションで一括更新
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.return.update({
          where: { id: id.value },
          data: { order: index },
        })
      )
    );
  }

  /**
   * Prismaモデルからドメインエンティティへのマッピング
   */
  private toDomain(prismaReturn: PrismaReturn): Return {
    const returnIdResult = ReturnId.create(prismaReturn.id);
    if (!returnIdResult.success) {
      throw new Error(`Invalid returnId in database: ${prismaReturn.id}`);
    }

    const projectIdResult = ProjectId.create(prismaReturn.projectId);
    if (!projectIdResult.success) {
      throw new Error(`Invalid projectId in database: ${prismaReturn.projectId}`);
    }

    return Return.reconstruct({
      id: returnIdResult.data,
      projectId: projectIdResult.data,
      name: prismaReturn.name,
      description: prismaReturn.description,
      estimatedDeliveryDate: prismaReturn.estimatedDeliveryDate,
      quantityLimit: prismaReturn.quantityLimit,
      order: prismaReturn.order,
      createdAt: prismaReturn.createdAt,
    });
  }
}
