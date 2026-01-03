/**
 * Result type for explicit error handling
 * Following the Result pattern instead of throwing exceptions
 */
export type Result<T, E> = { success: true; data: T } | { success: false; error: E };

/**
 * Application-wide error types
 */
export type AppError =
  | { code: "VALIDATION_ERROR"; message: string; fields?: Record<string, string[]> }
  | { code: "NOT_FOUND"; resource: string }
  | { code: "UNAUTHORIZED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "INTERNAL_ERROR"; message: string };

/**
 * Helper functions for creating Result values
 */
export const ok = <T>(data: T): Result<T, never> => ({ success: true, data });

export const err = <E>(error: E): Result<never, E> => ({ success: false, error });

/**
 * Helper functions for creating AppError values
 */
export const validationError = (
  message: string,
  fields?: Record<string, string[]>
): AppError => ({
  code: "VALIDATION_ERROR",
  message,
  fields,
});

export const notFoundError = (resource: string): AppError => ({
  code: "NOT_FOUND",
  resource,
});

export const unauthorizedError = (message: string): AppError => ({
  code: "UNAUTHORIZED",
  message,
});

export const forbiddenError = (message: string): AppError => ({
  code: "FORBIDDEN",
  message,
});

export const conflictError = (message: string): AppError => ({
  code: "CONFLICT",
  message,
});

export const internalError = (message: string): AppError => ({
  code: "INTERNAL_ERROR",
  message,
});
