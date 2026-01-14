import { PrismaClient, ExperienceSchedule as PrismaSchedule } from "@prisma/client";
import { Schedule } from "@/domain/schedule/entities/Schedule";
import { ScheduleRepository } from "@/domain/schedule/repositories/ScheduleRepository";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";

/**
 * PrismaScheduleRepository
 * ScheduleRepositoryインターフェースのPrisma実装
 * ドメインエンティティとPrismaモデル間の変換を担当
 */
export class PrismaScheduleRepository implements ScheduleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * IDでスケジュールを検索
   */
  async findById(id: ScheduleId): Promise<Schedule | null> {
    const prismaSchedule = await this.prisma.experienceSchedule.findUnique({
      where: { id: id.value },
    });

    if (!prismaSchedule) {
      return null;
    }

    return this.toDomain(prismaSchedule);
  }

  /**
   * プロジェクトIDでスケジュール一覧を取得
   */
  async findByProjectId(projectId: ProjectId): Promise<Schedule[]> {
    const prismaSchedules = await this.prisma.experienceSchedule.findMany({
      where: { projectId: projectId.value },
      orderBy: { startDateTime: "asc" },
    });

    return prismaSchedules.map((s) => this.toDomain(s));
  }

  /**
   * プロジェクトIDで今後のスケジュール一覧を取得
   */
  async findUpcomingByProjectId(projectId: ProjectId): Promise<Schedule[]> {
    const now = new Date();
    const prismaSchedules = await this.prisma.experienceSchedule.findMany({
      where: {
        projectId: projectId.value,
        startDateTime: { gt: now },
      },
      orderBy: { startDateTime: "asc" },
    });

    return prismaSchedules.map((s) => this.toDomain(s));
  }

  /**
   * 新規スケジュールを作成
   */
  async create(schedule: Schedule): Promise<Schedule> {
    const prismaSchedule = await this.prisma.experienceSchedule.create({
      data: {
        id: schedule.id.value,
        projectId: schedule.projectId.value,
        title: schedule.title,
        description: schedule.description,
        startDateTime: schedule.startDateTime,
        duration: schedule.duration,
        capacity: schedule.capacity,
        requirements: schedule.requirements,
      },
    });

    return this.toDomain(prismaSchedule);
  }

  /**
   * スケジュール情報を更新
   */
  async update(schedule: Schedule): Promise<Schedule> {
    const prismaSchedule = await this.prisma.experienceSchedule.update({
      where: { id: schedule.id.value },
      data: {
        title: schedule.title,
        description: schedule.description,
        startDateTime: schedule.startDateTime,
        duration: schedule.duration,
        capacity: schedule.capacity,
        requirements: schedule.requirements,
      },
    });

    return this.toDomain(prismaSchedule);
  }

  /**
   * スケジュールを削除
   */
  async delete(id: ScheduleId): Promise<void> {
    await this.prisma.experienceSchedule.delete({
      where: { id: id.value },
    });
  }

  /**
   * プロジェクトのスケジュール数をカウント
   */
  async countByProjectId(projectId: ProjectId): Promise<number> {
    return this.prisma.experienceSchedule.count({
      where: { projectId: projectId.value },
    });
  }

  /**
   * Prismaモデルからドメインエンティティへのマッピング
   */
  private toDomain(prismaSchedule: PrismaSchedule): Schedule {
    // ScheduleId値オブジェクトの復元
    const scheduleIdResult = ScheduleId.create(prismaSchedule.id);
    if (!scheduleIdResult.success) {
      throw new Error(`Invalid scheduleId in database: ${prismaSchedule.id}`);
    }

    // ProjectId値オブジェクトの復元
    const projectIdResult = ProjectId.create(prismaSchedule.projectId);
    if (!projectIdResult.success) {
      throw new Error(`Invalid projectId in database: ${prismaSchedule.projectId}`);
    }

    // ドメインエンティティの復元
    return Schedule.reconstruct({
      id: scheduleIdResult.data,
      projectId: projectIdResult.data,
      title: prismaSchedule.title,
      description: prismaSchedule.description,
      startDateTime: prismaSchedule.startDateTime,
      duration: prismaSchedule.duration,
      capacity: prismaSchedule.capacity,
      requirements: prismaSchedule.requirements,
      createdAt: prismaSchedule.createdAt,
      updatedAt: prismaSchedule.updatedAt,
    });
  }
}
