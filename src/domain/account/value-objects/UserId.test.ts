import { UserId } from "./UserId";

describe("UserId", () => {
  describe("create", () => {
    it("should create a valid UserId with UUID format", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = UserId.create(uuid);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(uuid);
      }
    });

    it("should return error for empty string", () => {
      const result = UserId.create("");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should return error for invalid UUID format", () => {
      const result = UserId.create("not-a-uuid");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should return error for UUID with wrong number of characters", () => {
      const result = UserId.create("550e8400-e29b-41d4-a716");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("generate", () => {
    it("should generate a new valid UserId", () => {
      const userId = UserId.generate();

      expect(userId.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("should generate unique UserIds", () => {
      const userId1 = UserId.generate();
      const userId2 = UserId.generate();

      expect(userId1.value).not.toBe(userId2.value);
    });
  });

  describe("equals", () => {
    it("should return true for same UserId values", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result1 = UserId.create(uuid);
      const result2 = UserId.create(uuid);

      if (result1.success && result2.success) {
        expect(result1.data.equals(result2.data)).toBe(true);
      }
    });

    it("should return false for different UserId values", () => {
      const result1 = UserId.create("550e8400-e29b-41d4-a716-446655440000");
      const result2 = UserId.create("550e8400-e29b-41d4-a716-446655440001");

      if (result1.success && result2.success) {
        expect(result1.data.equals(result2.data)).toBe(false);
      }
    });
  });
});
