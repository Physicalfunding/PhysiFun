import { Password, HashedPassword } from "@/domain/account/value-objects/Password";

describe("Password", () => {
  describe("create", () => {
    it("should create a valid password with 8 characters", () => {
      const result = Password.create("Pass1234");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe("Pass1234");
      }
    });

    it("should create a valid password with more than 8 characters", () => {
      const result = Password.create("SecurePassword123!");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe("SecurePassword123!");
      }
    });

    it("should return error for empty password", () => {
      const result = Password.create("");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("パスワード");
      }
    });

    it("should return error for password less than 8 characters", () => {
      const result = Password.create("Short1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("8文字");
      }
    });

    it("should return error for password with 7 characters", () => {
      const result = Password.create("Pass123");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should return error for whitespace-only password", () => {
      const result = Password.create("        ");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("hash", () => {
    it("should hash the password", async () => {
      const passwordResult = Password.create("SecurePass123");

      if (passwordResult.success) {
        const hashed = await passwordResult.data.hash();
        expect(hashed.value).not.toBe("SecurePass123");
        expect(hashed.value.length).toBeGreaterThan(0);
      }
    });

    it("should generate different hashes for same password", async () => {
      const password1 = Password.create("SecurePass123");
      const password2 = Password.create("SecurePass123");

      if (password1.success && password2.success) {
        const hash1 = await password1.data.hash();
        const hash2 = await password2.data.hash();
        expect(hash1.value).not.toBe(hash2.value);
      }
    });
  });
});

describe("HashedPassword", () => {
  describe("fromHash", () => {
    it("should create HashedPassword from existing hash", () => {
      const hash = "$2b$10$somehashedvalue";
      const result = HashedPassword.fromHash(hash);

      expect(result.value).toBe(hash);
    });
  });

  describe("verify", () => {
    it("should return true for correct password", async () => {
      const passwordResult = Password.create("SecurePass123");

      if (passwordResult.success) {
        const hashed = await passwordResult.data.hash();
        const isValid = await hashed.verify("SecurePass123");
        expect(isValid).toBe(true);
      }
    });

    it("should return false for incorrect password", async () => {
      const passwordResult = Password.create("SecurePass123");

      if (passwordResult.success) {
        const hashed = await passwordResult.data.hash();
        const isValid = await hashed.verify("WrongPassword");
        expect(isValid).toBe(false);
      }
    });

    it("should return false for empty password", async () => {
      const passwordResult = Password.create("SecurePass123");

      if (passwordResult.success) {
        const hashed = await passwordResult.data.hash();
        const isValid = await hashed.verify("");
        expect(isValid).toBe(false);
      }
    });
  });
});
