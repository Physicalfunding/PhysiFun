import { RegisterUserUseCase, RegisterUserInput } from "@/application/use-cases/auth/RegisterUserUseCase";
import { UserRepository } from "@/domain/account/repositories/UserRepository";
import { User, UserType } from "@/domain/account/entities/User";
import { Email } from "@/domain/account/value-objects/Email";
import { UserId } from "@/domain/account/value-objects/UserId";
import { HashedPassword } from "@/domain/account/value-objects/Password";

/**
 * モックリポジトリの作成
 * テスト用にUserRepositoryインターフェースをモック化
 */
const createMockUserRepository = (): jest.Mocked<UserRepository> => ({
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
});

describe("RegisterUserUseCase", () => {
  let useCase: RegisterUserUseCase;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    useCase = new RegisterUserUseCase(mockUserRepository);
  });

  describe("execute", () => {
    const validInput: RegisterUserInput = {
      email: "test@example.com",
      password: "password123",
      name: "テストユーザー",
      userType: UserType.GUEST,
    };

    it("should register a new user successfully", async () => {
      // Arrange: メール重複なし
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email.value).toBe("test@example.com");
        expect(result.data.name).toBe("テストユーザー");
        expect(result.data.userType).toBe(UserType.GUEST);
      }
      expect(mockUserRepository.findByEmail).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.create).toHaveBeenCalledTimes(1);
    });

    it("should return error when email already exists", async () => {
      // Arrange: 既存ユーザーが存在
      const existingUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CONFLICT");
        expect(result.error.message).toContain("メールアドレス");
      }
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it("should return error for invalid email format", async () => {
      // Act
      const result = await useCase.execute({
        ...validInput,
        email: "invalid-email",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should return error when password is less than 8 characters", async () => {
      // Act
      const result = await useCase.execute({
        ...validInput,
        password: "short",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("8文字");
      }
    });

    it("should return error when name is empty", async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act
      const result = await useCase.execute({
        ...validInput,
        name: "   ",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should hash the password before storing", async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        // パスワードがハッシュ化されていることを確認
        // bcryptハッシュは$2で始まる
        expect(result.data.passwordHash.value).toMatch(/^\$2[aby]?\$/);
      }
    });

    it("should accept HOST user type", async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute({
        ...validInput,
        userType: UserType.HOST,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userType).toBe(UserType.HOST);
      }
    });

    it("should accept BOTH user type", async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute({
        ...validInput,
        userType: UserType.BOTH,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userType).toBe(UserType.BOTH);
      }
    });
  });
});

/**
 * テスト用モックユーザーを作成するヘルパー関数
 */
function createMockUser(): User {
  const emailResult = Email.create("existing@example.com");
  if (!emailResult.success) throw new Error("Failed to create email");

  const userResult = User.create({
    id: UserId.generate(),
    email: emailResult.data,
    passwordHash: HashedPassword.fromHash("$2a$10$mockhash"),
    name: "既存ユーザー",
    userType: UserType.GUEST,
  });

  if (!userResult.success) throw new Error("Failed to create user");
  return userResult.data;
}
