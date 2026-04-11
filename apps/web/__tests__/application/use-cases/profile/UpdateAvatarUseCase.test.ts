import {
  UpdateAvatarUseCase,
  UpdateAvatarInput,
} from "@/application/use-cases/profile/UpdateAvatarUseCase";
import { UserRepository } from "@/domain/account/repositories/UserRepository";
import { ImageUploadService } from "@/infrastructure/storage/ImageUploadService";
import { User, UserType } from "@/domain/account/entities/User";
import { UserId } from "@/domain/account/value-objects/UserId";
import { Email } from "@/domain/account/value-objects/Email";
import { HashedPassword } from "@/domain/account/value-objects/Password";

/**
 * UpdateAvatarUseCaseのテスト
 * アバター画像更新機能のビジネスロジックをテスト
 */
describe("UpdateAvatarUseCase", () => {
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockImageUploadService: jest.Mocked<ImageUploadService>;
  let useCase: UpdateAvatarUseCase;
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

    mockImageUploadService = {
      uploadImage: jest.fn(),
      deleteImage: jest.fn(),
      getPublicUrl: jest.fn(),
    };

    useCase = new UpdateAvatarUseCase(mockUserRepository, mockImageUploadService);

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
    });

    if (!userResult.success) {
      throw new Error("Failed to create test user");
    }

    testUser = userResult.data;
  });

  describe("execute", () => {
    it("should update avatar successfully", async () => {
      // Arrange
      const input: UpdateAvatarInput = {
        userId: testUserId,
        file: {
          name: "avatar.jpg",
          type: "image/jpeg",
          size: 1024 * 100, // 100KB
          buffer: Buffer.from("fake image data"),
        },
      };

      const uploadedUrl = "https://storage.example.com/avatars/avatar.jpg";
      mockUserRepository.findById.mockResolvedValue(testUser);
      mockImageUploadService.uploadImage.mockResolvedValue({
        path: "avatars/avatar.jpg",
        publicUrl: uploadedUrl,
      });
      mockUserRepository.update.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.avatarUrl).toBe(uploadedUrl);
      }
      expect(mockImageUploadService.uploadImage).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
    });

    it("should return error when user not found", async () => {
      // Arrange
      const input: UpdateAvatarInput = {
        userId: testUserId,
        file: {
          name: "avatar.jpg",
          type: "image/jpeg",
          size: 1024 * 100,
          buffer: Buffer.from("fake image data"),
        },
      };

      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
      expect(mockImageUploadService.uploadImage).not.toHaveBeenCalled();
    });

    it("should return error for invalid file type", async () => {
      // Arrange
      const input: UpdateAvatarInput = {
        userId: testUserId,
        file: {
          name: "document.pdf",
          type: "application/pdf",
          size: 1024 * 100,
          buffer: Buffer.from("fake pdf data"),
        },
      };

      mockUserRepository.findById.mockResolvedValue(testUser);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("画像ファイル");
      }
      expect(mockImageUploadService.uploadImage).not.toHaveBeenCalled();
    });

    it("should return error for file size exceeding 5MB", async () => {
      // Arrange
      const input: UpdateAvatarInput = {
        userId: testUserId,
        file: {
          name: "large-avatar.jpg",
          type: "image/jpeg",
          size: 6 * 1024 * 1024, // 6MB
          buffer: Buffer.alloc(6 * 1024 * 1024),
        },
      };

      mockUserRepository.findById.mockResolvedValue(testUser);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("5MB");
      }
      expect(mockImageUploadService.uploadImage).not.toHaveBeenCalled();
    });

    it("should accept PNG images", async () => {
      // Arrange
      const input: UpdateAvatarInput = {
        userId: testUserId,
        file: {
          name: "avatar.png",
          type: "image/png",
          size: 1024 * 100,
          buffer: Buffer.from("fake png data"),
        },
      };

      mockUserRepository.findById.mockResolvedValue(testUser);
      mockImageUploadService.uploadImage.mockResolvedValue({
        path: "avatars/avatar.png",
        publicUrl: "https://storage.example.com/avatars/avatar.png",
      });
      mockUserRepository.update.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should accept WebP images", async () => {
      // Arrange
      const input: UpdateAvatarInput = {
        userId: testUserId,
        file: {
          name: "avatar.webp",
          type: "image/webp",
          size: 1024 * 100,
          buffer: Buffer.from("fake webp data"),
        },
      };

      mockUserRepository.findById.mockResolvedValue(testUser);
      mockImageUploadService.uploadImage.mockResolvedValue({
        path: "avatars/avatar.webp",
        publicUrl: "https://storage.example.com/avatars/avatar.webp",
      });
      mockUserRepository.update.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should delete old avatar when updating", async () => {
      // Arrange
      // 既存のアバターを持つユーザー
      const userIdResult = UserId.create(testUserId);
      const emailResult = Email.create(testEmail);

      if (!userIdResult.success || !emailResult.success) {
        throw new Error("Failed to create test data");
      }

      const userWithAvatar = User.reconstruct({
        id: userIdResult.data,
        email: emailResult.data,
        passwordHash: HashedPassword.fromHash("$2b$10$hashedpassword"),
        name: "テストユーザー",
        userType: UserType.GUEST,
        bio: null,
        avatarUrl: "https://storage.example.com/avatars/old-avatar.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const input: UpdateAvatarInput = {
        userId: testUserId,
        file: {
          name: "new-avatar.jpg",
          type: "image/jpeg",
          size: 1024 * 100,
          buffer: Buffer.from("fake image data"),
        },
      };

      mockUserRepository.findById.mockResolvedValue(userWithAvatar);
      mockImageUploadService.uploadImage.mockResolvedValue({
        path: "avatars/new-avatar.jpg",
        publicUrl: "https://storage.example.com/avatars/new-avatar.jpg",
      });
      mockUserRepository.update.mockImplementation(async (user) => user);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.success).toBe(true);
      // 古い画像の削除が呼ばれることを確認
      expect(mockImageUploadService.deleteImage).toHaveBeenCalled();
    });

    it("should return error for invalid userId format", async () => {
      // Arrange
      const input: UpdateAvatarInput = {
        userId: "invalid-uuid",
        file: {
          name: "avatar.jpg",
          type: "image/jpeg",
          size: 1024 * 100,
          buffer: Buffer.from("fake image data"),
        },
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
