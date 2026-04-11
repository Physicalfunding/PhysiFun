/**
 * Result type for explicit error handling
 * Following the Result pattern instead of throwing exceptions
 */
export type Result<T, E> = { success: true; data: T } | { success: false; error: E };

/**
 * Application-wide error types
 */
export type ValidationError = {
  code: "VALIDATION_ERROR";
  message: string;
  fields?: Record<string, string[]>;
};
export type NotFoundError = { code: "NOT_FOUND"; resource: string; message: string };
export type UnauthorizedError = { code: "UNAUTHORIZED"; message: string };
export type ForbiddenError = { code: "FORBIDDEN"; message: string };
export type ConflictError = { code: "CONFLICT"; message: string };
export type InternalError = { code: "INTERNAL_ERROR"; message: string };

export type AppError =
  | ValidationError
  | NotFoundError
  | UnauthorizedError
  | ForbiddenError
  | ConflictError
  | InternalError;

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
): ValidationError => ({
  code: "VALIDATION_ERROR",
  message,
  fields,
});

export const notFoundError = (resource: string): NotFoundError => ({
  code: "NOT_FOUND",
  resource,
  message: `${resource}が見つかりません`,
});

export const unauthorizedError = (message: string): UnauthorizedError => ({
  code: "UNAUTHORIZED",
  message,
});

export const forbiddenError = (message: string): ForbiddenError => ({
  code: "FORBIDDEN",
  message,
});

export const conflictError = (message: string): ConflictError => ({
  code: "CONFLICT",
  message,
});

export const internalError = (message: string): InternalError => ({
  code: "INTERNAL_ERROR",
  message,
});
