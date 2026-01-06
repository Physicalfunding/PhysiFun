import { GetProfileUseCase, GetProfileInput, GetProfileOutput } from "./GetProfileUseCase";
import { UserRepository } from "@/domain/account/repositories/UserRepository";
import { User, UserType } from "@/domain/account/entities/User";
import { UserId } from "@/domain/account/value-objects/UserId";
import { Email } from "@/domain/account/value-objects/Email";
import { HashedPassword } from "@/domain/account/value-objects/Password";

/**
 * GetProfileUseCaseのテスト
 * プロフィール取得機能のビジネスロジックをテスト
 */
describe("GetProfileUseCase", () => {
  let mockUserRepository: jest.Mocked<UserRepository>;
  let useCase: GetProfileUseCase;
  let testUser: User;

  const testUserId = "550e8400-e29b-41d4-a716-446655440000";
  const testEmail = "test@example.com";

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    useCase = new GetProfileUseCase(mockUserRepository);

    // テスト用ユーザーの作成
    const userIdResult = UserId.create(testUserId);
    const emailResult = Email.create(testEmail);

    if (!userIdResult.success || !emailResult.success) {
      throw new Error("Failed to create test data");
    }

    const userResult = User.create({
      id: userIdResult.data,
      email: emailResult.data,
      passwordHash: HashedPassword.fromHash("$2b$10$hashedpassword"),
      name: "テストユーザー",
      userType: UserType.BOTH,
      bio: "自己紹介文",
      avatarUrl: "https://example.com/avatar.jpg",
    });

    if (!userResult.success) {
      throw new Error("Failed to create test user");
    }

    testUser = userResult.data;
  });

  describe("execute", () => {
    it("should return user profile successfully", async () => {
      // Arrange
      const input: GetProfileInput = {
        userId: testUserId,
      };

      mockUserRepository.findById.mockResolvedValue(testUser);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(testUserId);
        expect(result.data.email).toBe(testEmail);
        expect(result.data.name).toBe("テストユーザー");
        expect(result.data.bio).toBe("自己紹介文");
        expect(result.data.avatarUrl).toBe("https://example.com/avatar.jpg");
        expect(result.data.userType).toBe(UserType.BOTH);
      }
    });

    it("should return error when user not found", async () => {
      // Arrange
      const input: GetProfileInput = {
        userId: testUserId,
      };

      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return error for invalid userId format", async () => {
      // Arrange
      const input: GetProfileInput = {
        userId: "invalid-uuid",
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should handle user with null bio and avatarUrl", async () => {
      // Arrange
      const userIdResult = UserId.create(testUserId);
      const emailResult = Email.create(testEmail);

      if (!userIdResult.success || !emailResult.success) {
        throw new Error("Failed to create test data");
      }

      const userWithNullsResult = User.create({
        id: userIdResult.data,
        email: emailResult.data,
        passwordHash: HashedPassword.fromHash("$2b$10$hashedpassword"),
        name: "テストユーザー",
        userType: UserType.GUEST,
      });

      if (!userWithNullsResult.success) {
        throw new Error("Failed to create test user");
      }

      const input: GetProfileInput = {
        userId: testUserId,
      };

      mockUserRepository.findById.mockResolvedValue(userWithNullsResult.data);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bio).toBeNull();
        expect(result.data.avatarUrl).toBeNull();
      }
    });
  });
});
