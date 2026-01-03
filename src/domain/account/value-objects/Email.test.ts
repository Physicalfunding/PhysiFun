import { Email } from "./Email";

describe("Email", () => {
  describe("create", () => {
    it("should create a valid email", () => {
      const result = Email.create("test@example.com");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe("test@example.com");
      }
    });

    it("should create email with subdomain", () => {
      const result = Email.create("user@mail.example.com");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe("user@mail.example.com");
      }
    });

    it("should normalize email to lowercase", () => {
      const result = Email.create("Test@EXAMPLE.COM");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe("test@example.com");
      }
    });

    it("should return error for empty string", () => {
      const result = Email.create("");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("メールアドレス");
      }
    });

    it("should return error for missing @ symbol", () => {
      const result = Email.create("invalidemail.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should return error for missing domain", () => {
      const result = Email.create("test@");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should return error for missing local part", () => {
      const result = Email.create("@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should return error for invalid characters", () => {
      const result = Email.create("test user@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("equals", () => {
    it("should return true for same email addresses", () => {
      const email1 = Email.create("test@example.com");
      const email2 = Email.create("test@example.com");

      if (email1.success && email2.success) {
        expect(email1.data.equals(email2.data)).toBe(true);
      }
    });

    it("should return true for case-insensitive comparison", () => {
      const email1 = Email.create("Test@Example.com");
      const email2 = Email.create("test@example.com");

      if (email1.success && email2.success) {
        expect(email1.data.equals(email2.data)).toBe(true);
      }
    });

    it("should return false for different email addresses", () => {
      const email1 = Email.create("test1@example.com");
      const email2 = Email.create("test2@example.com");

      if (email1.success && email2.success) {
        expect(email1.data.equals(email2.data)).toBe(false);
      }
    });
  });
});
