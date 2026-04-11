import { User, UserType } from "@/domain/account/entities/User";
import { Email } from "@/domain/account/value-objects/Email";
import { HashedPassword } from "@/domain/account/value-objects/Password";
import { UserId } from "@/domain/account/value-objects/UserId";

describe("User", () => {
  const createValidEmail = () => {
    const result = Email.create("test@example.com");
    if (!result.success) throw new Error("Failed to create email");
    return result.data;
  };

  const createValidUserId = () => {
    return UserId.generate();
  };

  const createHashedPassword = () => {
    return HashedPassword.fromHash("$2b$10$hashedpassword");
  };

  describe("create", () => {
    it("should create a valid user with HOST type", () => {
      const result = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "テストユーザー",
        userType: UserType.HOST,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("テストユーザー");
        expect(result.data.userType).toBe(UserType.HOST);
        expect(result.data.bio).toBeNull();
        expect(result.data.avatarUrl).toBeNull();
      }
    });

    it("should create a valid user with GUEST type", () => {
      const result = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "ゲストユーザー",
        userType: UserType.GUEST,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userType).toBe(UserType.GUEST);
      }
    });

    it("should create user with optional bio and avatarUrl", () => {
      const result = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "テストユーザー",
        userType: UserType.HOST,
        bio: "自己紹介文です",
        avatarUrl: "https://example.com/avatar.jpg",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bio).toBe("自己紹介文です");
        expect(result.data.avatarUrl).toBe("https://example.com/avatar.jpg");
      }
    });

    it("should return error for empty name", () => {
      const result = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "",
        userType: UserType.HOST,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("名前");
      }
    });

    it("should return error for whitespace-only name", () => {
      const result = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "   ",
        userType: UserType.HOST,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("reconstruct", () => {
    it("should reconstruct a user from persisted data", () => {
      const id = createValidUserId();
      const email = createValidEmail();
      const passwordHash = createHashedPassword();
      const now = new Date();

      const user = User.reconstruct({
        id,
        email,
        passwordHash,
        name: "再構築ユーザー",
        userType: UserType.HOST,
        bio: "bio",
        avatarUrl: "https://example.com/avatar.jpg",
        createdAt: now,
        updatedAt: now,
      });

      expect(user.id.value).toBe(id.value);
      expect(user.email.value).toBe(email.value);
      expect(user.name).toBe("再構築ユーザー");
      expect(user.userType).toBe(UserType.HOST);
      expect(user.bio).toBe("bio");
      expect(user.avatarUrl).toBe("https://example.com/avatar.jpg");
      expect(user.createdAt).toBe(now);
      expect(user.updatedAt).toBe(now);
    });
  });

  describe("updateProfile", () => {
    it("should update name", () => {
      const createResult = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "元の名前",
        userType: UserType.HOST,
      });

      if (!createResult.success) throw new Error("Failed to create user");

      const updateResult = createResult.data.updateProfile({ name: "新しい名前" });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.name).toBe("新しい名前");
      }
    });

    it("should update bio", () => {
      const createResult = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "テストユーザー",
        userType: UserType.HOST,
      });

      if (!createResult.success) throw new Error("Failed to create user");

      const updateResult = createResult.data.updateProfile({ bio: "新しい自己紹介" });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.bio).toBe("新しい自己紹介");
      }
    });

    it("should update userType", () => {
      const createResult = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "テストユーザー",
        userType: UserType.HOST,
      });

      if (!createResult.success) throw new Error("Failed to create user");

      const updateResult = createResult.data.updateProfile({ userType: UserType.GUEST });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.userType).toBe(UserType.GUEST);
      }
    });

    it("should return error for empty name update", () => {
      const createResult = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "テストユーザー",
        userType: UserType.HOST,
      });

      if (!createResult.success) throw new Error("Failed to create user");

      const updateResult = createResult.data.updateProfile({ name: "" });

      expect(updateResult.success).toBe(false);
      if (!updateResult.success) {
        expect(updateResult.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("updateAvatar", () => {
    it("should update avatar URL", () => {
      const createResult = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "テストユーザー",
        userType: UserType.HOST,
      });

      if (!createResult.success) throw new Error("Failed to create user");

      const updated = createResult.data.updateAvatar("https://example.com/new-avatar.jpg");

      expect(updated.avatarUrl).toBe("https://example.com/new-avatar.jpg");
    });
  });

  describe("isHost", () => {
    it("should return true for HOST user", () => {
      const createResult = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "テストユーザー",
        userType: UserType.HOST,
      });

      if (!createResult.success) throw new Error("Failed to create user");

      expect(createResult.data.isHost()).toBe(true);
    });

    it("should return false for GUEST user", () => {
      const createResult = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "テストユーザー",
        userType: UserType.GUEST,
      });

      if (!createResult.success) throw new Error("Failed to create user");

      expect(createResult.data.isHost()).toBe(false);
    });
  });

  describe("isGuest", () => {
    it("should return true for GUEST user", () => {
      const createResult = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "テストユーザー",
        userType: UserType.GUEST,
      });

      if (!createResult.success) throw new Error("Failed to create user");

      expect(createResult.data.isGuest()).toBe(true);
    });

    it("should return false for HOST user", () => {
      const createResult = User.create({
        id: createValidUserId(),
        email: createValidEmail(),
        passwordHash: createHashedPassword(),
        name: "テストユーザー",
        userType: UserType.HOST,
      });

      if (!createResult.success) throw new Error("Failed to create user");

      expect(createResult.data.isGuest()).toBe(false);
    });
  });
});
