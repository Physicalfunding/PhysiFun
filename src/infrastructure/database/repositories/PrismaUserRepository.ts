import { PrismaClient, User as PrismaUser, UserType as PrismaUserType } from "@prisma/client";
import { User, UserType } from "@/domain/account/entities/User";
import { UserRepository } from "@/domain/account/repositories/UserRepository";
import { Email } from "@/domain/account/value-objects/Email";
import { HashedPassword } from "@/domain/account/value-objects/Password";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * PrismaUserRepository
 * UserRepositoryインターフェースのPrisma実装
 * ドメインエンティティとPrismaモデル間の変換を担当
 */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * IDでユーザーを検索
   */
  async findById(id: UserId): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: { id: id.value },
    });

    if (!prismaUser) {
      return null;
    }

    return this.toDomain(prismaUser);
  }

  /**
   * メールアドレスでユーザーを検索
   */
  async findByEmail(email: Email): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: { email: email.value },
    });

    if (!prismaUser) {
      return null;
    }

    return this.toDomain(prismaUser);
  }

  /**
   * 新規ユーザーを作成
   */
  async create(user: User): Promise<User> {
    const prismaUser = await this.prisma.user.create({
      data: {
        id: user.id.value,
        email: user.email.value,
        passwordHash: user.passwordHash.value,
        name: user.name,
        userType: this.toPrismaUserType(user.userType),
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      },
    });

    return this.toDomain(prismaUser);
  }

  /**
   * ユーザー情報を更新
   */
  async update(user: User): Promise<User> {
    const prismaUser = await this.prisma.user.update({
      where: { id: user.id.value },
      data: {
        name: user.name,
        userType: this.toPrismaUserType(user.userType),
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      },
    });

    return this.toDomain(prismaUser);
  }

  /**
   * Prismaモデルからドメインエンティティへのマッピング
   */
  private toDomain(prismaUser: PrismaUser): User {
    // Email値オブジェクトの復元
    const emailResult = Email.create(prismaUser.email);
    if (!emailResult.success) {
      // DBから取得したデータは有効なはずなのでここには到達しない
      throw new Error(`Invalid email in database: ${prismaUser.email}`);
    }

    // UserId値オブジェクトの復元
    const userIdResult = UserId.create(prismaUser.id);
    if (!userIdResult.success) {
      throw new Error(`Invalid userId in database: ${prismaUser.id}`);
    }

    // ドメインエンティティの復元
    return User.reconstruct({
      id: userIdResult.data,
      email: emailResult.data,
      passwordHash: HashedPassword.fromHash(prismaUser.passwordHash),
      name: prismaUser.name,
      userType: this.toDomainUserType(prismaUser.userType),
      bio: prismaUser.bio,
      avatarUrl: prismaUser.avatarUrl,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    });
  }

  /**
   * ドメインUserTypeからPrismaUserTypeへの変換
   */
  private toPrismaUserType(userType: UserType): PrismaUserType {
    switch (userType) {
      case UserType.HOST:
        return "HOST";
      case UserType.GUEST:
        return "GUEST";
      case UserType.BOTH:
        return "BOTH";
    }
  }

  /**
   * PrismaUserTypeからドメインUserTypeへの変換
   */
  private toDomainUserType(prismaUserType: PrismaUserType): UserType {
    switch (prismaUserType) {
      case "HOST":
        return UserType.HOST;
      case "GUEST":
        return UserType.GUEST;
      case "BOTH":
        return UserType.BOTH;
    }
  }
}
