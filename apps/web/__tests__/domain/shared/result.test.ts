import {
  ok,
  err,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  conflictError,
  internalError,
  type Result,
  type AppError,
} from "@/domain/shared/result";

describe("Result type", () => {
  describe("ok", () => {
    it("should create a success result with data", () => {
      const result = ok("test data");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("test data");
      }
    });

    it("should create a success result with complex data", () => {
      const data = { id: "1", name: "Test" };
      const result = ok(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });
  });

  describe("err", () => {
    it("should create a failure result with error", () => {
      const error = validationError("Invalid input");
      const result = err(error);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(error);
      }
    });
  });
});

describe("AppError helpers", () => {
  describe("validationError", () => {
    it("should create a validation error with message", () => {
      const error = validationError("Invalid email format");

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toBe("Invalid email format");
      expect(error.fields).toBeUndefined();
    });

    it("should create a validation error with fields", () => {
      const error = validationError("Validation failed", {
        email: ["Invalid format", "Already exists"],
        password: ["Too short"],
      });

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.fields).toEqual({
        email: ["Invalid format", "Already exists"],
        password: ["Too short"],
      });
    });
  });

  describe("notFoundError", () => {
    it("should create a not found error", () => {
      const error = notFoundError("User");

      expect(error.code).toBe("NOT_FOUND");
      expect(error.resource).toBe("User");
    });
  });

  describe("unauthorizedError", () => {
    it("should create an unauthorized error", () => {
      const error = unauthorizedError("Invalid credentials");

      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Invalid credentials");
    });
  });

  describe("forbiddenError", () => {
    it("should create a forbidden error", () => {
      const error = forbiddenError("Access denied");

      expect(error.code).toBe("FORBIDDEN");
      expect(error.message).toBe("Access denied");
    });
  });

  describe("conflictError", () => {
    it("should create a conflict error", () => {
      const error = conflictError("Email already exists");

      expect(error.code).toBe("CONFLICT");
      expect(error.message).toBe("Email already exists");
    });
  });

  describe("internalError", () => {
    it("should create an internal error", () => {
      const error = internalError("Database connection failed");

      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.message).toBe("Database connection failed");
    });
  });
});
