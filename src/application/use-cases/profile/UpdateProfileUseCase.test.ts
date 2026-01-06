import { UpdateProfileUseCase, UpdateProfileInput, UpdateProfileOutput } from "./UpdateProfileUseCase";
import { UserRepository } from "@/domain/account/repositories/UserRepository";
import { User, UserType } from "@/domain/account/entities/User";
import { UserId } from "@/domain/account/value-objects/UserId";
import { Email } from "@/domain/account/value-objects/Email";
import { HashedPassword } from "@/domain/account/value-objects/Password";

/**
 * UpdateProfileUseCaseのテスト
 * プロフィール更新機能のビジネスロジックをテスト
 */
describe("UpdateProfileUseCase", () => {
  // モックリポジトリ
  let mockUserRepository: jest.Mocked<UserRepository>;
  let useCase: UpdateProfileUseCase;
  let testUser: User;

  // テスト用ユーザーIDとメール
  const testUserId = "550e8400-e29b-41d4-a716-446655440000";
  const testEmail = "test@example.com";

  beforeEach(() => {
    // モックリポジトリの初期化
    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    useCase = new UpdateProfileUseCase(mockUserRepository);

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
      userType: UserType.GUEST,
      bio: "元の自己紹介",
    });

    if (!userResult.success) {
      throw new Error("Failed to create test user");
    }

    testUser = userResult.data;
  });

  describe("execute", () => {
    it("should update user profile successfully", async () => {
      // Arrange
      const input: UpdateProfileInput = {
        userId: testUserId,
        name: "更新された名前",
        bio: "更新された自己紹介",
        userType: UserType.BOTH,
      };

      mockUserRepository.findById.mockResolvedValue(testUser);
      mockUserRepository.update.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("更新された名前");
        expect(result.data.bio).toBe("更新された自己紹介");
        expect(result.data.userType).toBe(UserType.BOTH);
      }
      expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
    });

    it("should return error when user not found", async () => {
      // Arrange
      const input: UpdateProfileInput = {
        userId: testUserId,
        name: "更新された名前",
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

    it("should return error when name is empty", async () => {
      // Arrange
      const input: UpdateProfileInput = {
        userId: testUserId,
        name: "",
      };

      mockUserRepository.findById.mockResolvedValue(testUser);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should return error when name is whitespace only", async () => {
      // Arrange
      const input: UpdateProfileInput = {
        userId: testUserId,
        name: "   ",
      };

      mockUserRepository.findById.mockResolvedValue(testUser);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should allow partial updates (only name)", async () => {
      // Arrange
      const input: UpdateProfileInput = {
        userId: testUserId,
        name: "新しい名前",
      };

      mockUserRepository.findById.mockResolvedValue(testUser);
      mockUserRepository.update.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("新しい名前");
        expect(result.data.bio).toBe("元の自己紹介"); // 元の値を保持
        expect(result.data.userType).toBe(UserType.GUEST); // 元の値を保持
      }
    });

    it("should allow partial updates (only bio)", async () => {
      // Arrange
      const input: UpdateProfileInput = {
        userId: testUserId,
        bio: "新しい自己紹介",
      };

      mockUserRepository.findById.mockResolvedValue(testUser);
      mockUserRepository.update.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("テストユーザー"); // 元の値を保持
        expect(result.data.bio).toBe("新しい自己紹介");
      }
    });

    it("should allow setting bio to null", async () => {
      // Arrange
      const input: UpdateProfileInput = {
        userId: testUserId,
        bio: null,
      };

      mockUserRepository.findById.mockResolvedValue(testUser);
      mockUserRepository.update.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bio).toBeNull();
      }
    });

    it("should return error for invalid userId format", async () => {
      // Arrange
      const input: UpdateProfileInput = {
        userId: "invalid-uuid",
        name: "新しい名前",
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
