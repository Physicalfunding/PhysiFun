import {
  PrismaClient,
  Participation as PrismaParticipation,
  ParticipationStatus as PrismaParticipationStatus,
} from "@prisma/client";
import { Participation, ParticipationStatus } from "@/domain/participation/entities/Participation";
import { ParticipationRepository } from "@/domain/participation/repositories/ParticipationRepository";
import { ParticipationId } from "@/domain/participation/value-objects/ParticipationId";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * PrismaParticipationRepository
 * ParticipationRepositoryインターフェースのPrisma実装
 */
export class PrismaParticipationRepository implements ParticipationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * IDで参加申込を検索
   */
  async findById(id: ParticipationId): Promise<Participation | null> {
    const prismaParticipation = await this.prisma.participation.findUnique({
      where: { id: id.value },
    });

    if (!prismaParticipation) {
      return null;
    }

    return this.toDomain(prismaParticipation);
  }

  /**
   * スケジュールIDで参加申込一覧を取得
   */
  async findByScheduleId(scheduleId: ScheduleId): Promise<Participation[]> {
    const prismaParticipations = await this.prisma.participation.findMany({
      where: { scheduleId: scheduleId.value },
      orderBy: { appliedAt: "desc" },
    });

    return prismaParticipations.map((p) => this.toDomain(p));
  }

  /**
   * ユーザーIDで参加申込一覧を取得
   */
  async findByUserId(userId: UserId): Promise<Participation[]> {
    const prismaParticipations = await this.prisma.participation.findMany({
      where: { guestId: userId.value },
      orderBy: { appliedAt: "desc" },
    });

    return prismaParticipations.map((p) => this.toDomain(p));
  }

  /**
   * ユーザーIDとスケジュールIDで参加申込を検索
   */
  async findByUserIdAndScheduleId(
    userId: UserId,
    scheduleId: ScheduleId
  ): Promise<Participation | null> {
    const prismaParticipation = await this.prisma.participation.findUnique({
      where: {
        guestId_scheduleId: {
          guestId: userId.value,
          scheduleId: scheduleId.value,
        },
      },
    });

    if (!prismaParticipation) {
      return null;
    }

    return this.toDomain(prismaParticipation);
  }

  /**
   * 新規参加申込を作成
   */
  async create(participation: Participation): Promise<Participation> {
    const prismaParticipation = await this.prisma.participation.create({
      data: {
        id: participation.id.value,
        guestId: participation.guestId.value,
        scheduleId: participation.scheduleId.value,
        participantCount: participation.participantCount,
        status: this.toPrismaStatus(participation.status),
        appliedAt: participation.appliedAt,
      },
    });

    return this.toDomain(prismaParticipation);
  }

  /**
   * 参加申込情報を更新
   */
  async update(participation: Participation): Promise<Participation> {
    const prismaParticipation = await this.prisma.participation.update({
      where: { id: participation.id.value },
      data: {
        status: this.toPrismaStatus(participation.status),
      },
    });

    return this.toDomain(prismaParticipation);
  }

  /**
   * 参加申込を削除
   */
  async delete(id: ParticipationId): Promise<void> {
    await this.prisma.participation.delete({
      where: { id: id.value },
    });
  }

  /**
   * スケジュールの参加申込数をカウント
   */
  async countByScheduleId(scheduleId: ScheduleId): Promise<number> {
    return this.prisma.participation.count({
      where: {
        scheduleId: scheduleId.value,
        status: { not: "CANCELLED" },
      },
    });
  }

  /**
   * スケジュールの合計参加人数をカウント
   */
  async sumParticipantCountByScheduleId(scheduleId: ScheduleId): Promise<number> {
    const result = await this.prisma.participation.aggregate({
      where: {
        scheduleId: scheduleId.value,
        status: { not: "CANCELLED" },
      },
      _sum: {
        participantCount: true,
      },
    });

    return result._sum.participantCount ?? 0;
  }

  /**
   * Prismaモデルからドメインエンティティへのマッピング
   */
  private toDomain(prismaParticipation: PrismaParticipation): Participation {
    const participationIdResult = ParticipationId.create(prismaParticipation.id);
    if (!participationIdResult.success) {
      throw new Error(`Invalid participationId in database: ${prismaParticipation.id}`);
    }

    const guestIdResult = UserId.create(prismaParticipation.guestId);
    if (!guestIdResult.success) {
      throw new Error(`Invalid guestId in database: ${prismaParticipation.guestId}`);
    }

    const scheduleIdResult = ScheduleId.create(prismaParticipation.scheduleId);
    if (!scheduleIdResult.success) {
      throw new Error(`Invalid scheduleId in database: ${prismaParticipation.scheduleId}`);
    }

    return Participation.reconstruct({
      id: participationIdResult.data,
      guestId: guestIdResult.data,
      scheduleId: scheduleIdResult.data,
      participantCount: prismaParticipation.participantCount,
      status: this.toDomainStatus(prismaParticipation.status),
      appliedAt: prismaParticipation.appliedAt,
      createdAt: prismaParticipation.createdAt,
      updatedAt: prismaParticipation.updatedAt,
    });
  }

  /**
   * ドメインStatusからPrismaStatusへの変換
   */
  private toPrismaStatus(status: ParticipationStatus): PrismaParticipationStatus {
    switch (status) {
      case ParticipationStatus.PENDING:
        return "PENDING";
      case ParticipationStatus.CONFIRMED:
        return "CONFIRMED";
      case ParticipationStatus.CANCELLED:
        return "CANCELLED";
    }
  }

  /**
   * PrismaStatusからドメインStatusへの変換
   */
  private toDomainStatus(prismaStatus: PrismaParticipationStatus): ParticipationStatus {
    switch (prismaStatus) {
      case "PENDING":
        return ParticipationStatus.PENDING;
      case "CONFIRMED":
        return ParticipationStatus.CONFIRMED;
      case "CANCELLED":
        return ParticipationStatus.CANCELLED;
    }
  }
}
